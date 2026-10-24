/**
 * ChatRoom: one Durable Object per Umamin Chat match, named by its matchId.
 *
 * The rules live in lib/chat/engine.ts and the viewer projection in
 * lib/chat/project.ts; this class only loads and saves rows, runs timers and
 * moves frames. Cost rules that shape it (see docs/superpowers plan,
 * "Cost guardrails"):
 * - Sockets are accepted with the Hibernation API and pings are answered by
 *   the runtime's auto-response, so an idle room is evicted and costs nothing.
 * - Memory is a cache only. Everything is rebuilt from SQLite and socket
 *   attachments after hibernation.
 * - One chat message is one row written. `messages` uses a rowid primary key
 *   without AUTOINCREMENT (which would also write sqlite_sequence) and no
 *   secondary index.
 * - No setTimeout: every deadline is a row in `timers`, and the single alarm
 *   tracks MIN(at).
 * - A room that was never initialized is never written to, so probing random
 *   matchIds can't create storage.
 */
import { DurableObject } from "cloudflare:workers";
import {
  AUTH_DEADLINE_MS,
  AWAY_GRACE_MS,
  GRACE_MS,
  IDLE_MATCH_MS,
  MATCH_START_GRACE_MS,
  MAX_FRAME_CHARS,
  MAX_ROOM_SOCKETS,
  MESSAGE_CAP,
  SEND_DEDUPE_WINDOW,
  STALE_SOCKET_MS,
  SWEEP_INTERVAL_MS,
} from "../../lib/chat/constants";
import type {
  GameRecord,
  MatchState,
  MessageRow,
  NewMessage,
  OpContext,
  OpResult,
  Participant,
  Side,
} from "../../lib/chat/engine";
import * as engine from "../../lib/chat/engine";
import { SideLimiter } from "../../lib/chat/limits";
import { projectMessage, projectMeta } from "../../lib/chat/project";
import {
  CLOSE,
  PING,
  PONG,
  PROTOCOL_VERSION,
  parseFrame,
  type RoomFrame,
  type RoomOpFrame,
  type RoomServerFrame,
  roomFrameSchema,
} from "../../lib/chat/protocol";
import type { AppEnv } from "../env";
import { captureServerException } from "../posthog";
import { hashesEqual, hashSecret } from "./secret";

export interface RoomSeat extends Participant {
  sessionId: string;
  secretHash: string;
}

export interface RoomInit {
  matchId: string;
  a: RoomSeat;
  b: RoomSeat;
  /** The ChatLobby that created the room, told when the match ends so it
   *  stops counting it. */
  lobbyId?: string;
}

interface Attachment {
  side: Side | null;
  connectedAt: number;
}

interface Credentials {
  matchId: string;
  aSid: string;
  aHash: string;
  bSid: string;
  bHash: string;
}

type TimerKind = "start" | "away" | "burn" | "sweep" | "purge";

type MatchRowSql = {
  match_id: string;
  a_sid: string;
  a_hash: string;
  b_sid: string;
  b_hash: string;
  state: string;
};

type MessageRowSql = {
  seq: number;
  author: string;
  text: string;
  reaction_a: string | null;
  reaction_b: string | null;
  reply_to: number | null;
  kind: string | null;
  whisper_viewed_at: number | null;
  burned: number;
  game: string | null;
  effect: string | null;
  created_at: number;
  client_id: string | null;
};

const MESSAGE_COLUMNS =
  "seq, author, text, reaction_a, reaction_b, reply_to, kind, whisper_viewed_at, burned, game, effect, created_at, client_id";

const SIDE_REF: Record<Side, number> = { a: 0, b: 1 };

function toMessage(row: MessageRowSql): MessageRow {
  return {
    seq: row.seq,
    author: row.author as Side,
    text: row.text,
    reactionA: row.reaction_a,
    reactionB: row.reaction_b,
    replyTo: row.reply_to,
    kind: row.kind as MessageRow["kind"],
    whisperViewedAt: row.whisper_viewed_at,
    burned: row.burned === 1,
    game: row.game ? (JSON.parse(row.game) as GameRecord) : null,
    effect: row.effect as MessageRow["effect"],
    createdAt: row.created_at,
  };
}

export class ChatRoom extends DurableObject<AppEnv> {
  private readonly sql: SqlStorage;
  private readonly limiter = new SideLimiter();
  // Caches, rebuilt lazily after hibernation.
  private creds: Credentials | null | undefined;
  private match: MatchState | undefined;
  private alarmAt: number | null | undefined;

  constructor(ctx: DurableObjectState, env: AppEnv) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
  }

  // --- RPC from the lobby -------------------------------------------------

  async init(input: RoomInit): Promise<void> {
    if (this.loadCreds()) return;
    const now = Date.now();
    this.sql.exec(`CREATE TABLE IF NOT EXISTS match (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      match_id TEXT NOT NULL,
      a_sid TEXT NOT NULL, a_hash TEXT NOT NULL,
      b_sid TEXT NOT NULL, b_hash TEXT NOT NULL,
      state TEXT NOT NULL, lobby_id TEXT)`);
    // Rowid primary key, no AUTOINCREMENT: messages are only ever removed all
    // at once by deleteAll(), so seq stays monotonic without the extra write.
    this.sql.exec(`CREATE TABLE IF NOT EXISTS messages (
      seq INTEGER PRIMARY KEY,
      author TEXT NOT NULL, text TEXT NOT NULL,
      reaction_a TEXT, reaction_b TEXT, reply_to INTEGER, kind TEXT,
      whisper_viewed_at INTEGER, burned INTEGER NOT NULL DEFAULT 0,
      game TEXT, effect TEXT,
      created_at INTEGER NOT NULL, client_id TEXT)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS timers (
      kind TEXT NOT NULL, ref INTEGER NOT NULL, at INTEGER NOT NULL,
      PRIMARY KEY (kind, ref))`);
    const strip = ({ sessionId: _s, secretHash: _h, ...p }: RoomSeat) => p;
    const match = engine.initialMatch(strip(input.a), strip(input.b), now);
    this.sql.exec(
      "INSERT INTO match (id, match_id, a_sid, a_hash, b_sid, b_hash, state, lobby_id) VALUES (1, ?, ?, ?, ?, ?, ?, ?)",
      input.matchId,
      input.a.sessionId,
      input.a.secretHash,
      input.b.sessionId,
      input.b.secretHash,
      JSON.stringify(match),
      input.lobbyId ?? null,
    );
    this.setTimer("start", 0, now + MATCH_START_GRACE_MS);
    this.setTimer("sweep", 0, now + SWEEP_INTERVAL_MS);
    this.creds = {
      matchId: input.matchId,
      aSid: input.a.sessionId,
      aHash: input.a.secretHash,
      bSid: input.b.sessionId,
      bHash: input.b.secretHash,
    };
    this.match = match;
    await this.syncAlarm();
  }

  /** The lobby lost a side while creating the room: drop it entirely. */
  async abort(): Promise<void> {
    await this.purge();
  }

  // --- Sockets ------------------------------------------------------------

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    const { 0: client, 1: server } = new WebSocketPair();
    const crowded = this.ctx.getWebSockets().length >= MAX_ROOM_SOCKETS;
    this.ctx.acceptWebSocket(server);
    const attachment: Attachment = { side: null, connectedAt: Date.now() };
    server.serializeAttachment(attachment);
    // Unknown or purged room: close right away, without touching storage.
    if (!this.loadCreds()) server.close(CLOSE.GONE, "gone");
    else if (crowded) server.close(CLOSE.TOO_MANY, "too many");
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    try {
      const frame = parseFrame<RoomFrame>(
        roomFrameSchema,
        raw,
        MAX_FRAME_CHARS,
      );
      if (!frame) {
        ws.close(CLOSE.BAD_FRAME, "bad frame");
        return;
      }
      if (frame.t === "auth") {
        await this.handleAuth(ws, frame);
        return;
      }
      const side = this.attachment(ws).side;
      if (!side) {
        ws.close(CLOSE.UNAUTHORIZED, "unauthorized");
        return;
      }
      // A frame that raced the purge.
      if (!this.loadCreds()) {
        ws.close(CLOSE.GONE, "gone");
        return;
      }
      if (frame.t === "typing") {
        this.handleTyping(side, frame.on);
      } else {
        await this.handleOp(ws, side, frame);
      }
      // The object is awake anyway: catching half-open sockets here is free,
      // which lets the backstop sweep stay at minutes, not seconds.
      await this.closeStaleSockets(Date.now());
    } catch (err) {
      this.report(err, "message");
    }
  }

  async webSocketClose(ws: WebSocket) {
    try {
      await this.onSocketGone(ws);
    } catch (err) {
      this.report(err, "close");
    }
  }

  async webSocketError(ws: WebSocket) {
    try {
      await this.onSocketGone(ws);
    } catch (err) {
      this.report(err, "error");
    }
  }

  async alarm() {
    // The alarm that just fired is no longer set.
    this.alarmAt = null;
    try {
      await this.runTimers(Date.now());
    } catch (err) {
      this.report(err, "alarm");
      // Rethrow so the runtime retries the alarm; every timer is idempotent.
      throw err;
    }
  }

  // --- Auth and presence --------------------------------------------------

  private async handleAuth(
    ws: WebSocket,
    frame: Extract<RoomFrame, { t: "auth" }>,
  ) {
    if (frame.v !== PROTOCOL_VERSION) {
      ws.close(CLOSE.VERSION, "version");
      return;
    }
    const creds = this.loadCreds();
    if (!creds) {
      ws.close(CLOSE.GONE, "gone");
      return;
    }
    const hash = await hashSecret(frame.secret);
    const side: Side | null =
      frame.sessionId === creds.aSid && hashesEqual(hash, creds.aHash)
        ? "a"
        : frame.sessionId === creds.bSid && hashesEqual(hash, creds.bHash)
          ? "b"
          : null;
    if (!side) {
      ws.close(CLOSE.UNAUTHORIZED, "unauthorized");
      return;
    }
    const wasOnline = this.socketsFor(side).length > 0;
    ws.serializeAttachment({
      side,
      connectedAt: this.attachment(ws).connectedAt,
    } satisfies Attachment);

    let match = this.loadMatch();
    if (match.status === "active") {
      const seen = engine.markSeen(match, side);
      if (seen) {
        match = seen;
        this.saveMatch(match);
        if (engine.bothSeen(match)) this.clearTimer("start", 0);
      }
      this.clearTimer("away", SIDE_REF[side]);
      await this.syncAlarm();
    }

    this.sendTo(ws, {
      t: "sync",
      meta: this.metaFor(side),
      messages: this.recentMessages(side),
    });
    if (!wasOnline && match.status === "active") {
      this.broadcastMeta(engine.otherSide(side));
    }
  }

  private async onSocketGone(ws: WebSocket) {
    const side = this.attachment(ws).side;
    if (!side || !this.loadCreds()) return;
    const match = this.loadMatch();
    if (match.status !== "active") return;
    if (this.socketsFor(side, ws).length > 0) return;
    // Before both sides have connected, the start grace owns the outcome.
    if (!engine.bothSeen(match)) return;
    this.setTimer("away", SIDE_REF[side], Date.now() + AWAY_GRACE_MS, true);
    await this.syncAlarm();
    this.broadcastMeta(engine.otherSide(side), ws);
  }

  /** Closes half-open sockets (no auto-response pong recently) and sockets
   *  that never authenticated. */
  private async closeStaleSockets(now: number) {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const { side, connectedAt } = this.attachment(ws);
      if (!side) {
        if (now - connectedAt > AUTH_DEADLINE_MS) {
          ws.close(CLOSE.UNAUTHORIZED, "auth timeout");
        }
        continue;
      }
      const pongAt =
        this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? 0;
      if (now - Math.max(pongAt, connectedAt) > STALE_SOCKET_MS) {
        ws.close(CLOSE.NORMAL, "stale");
        await this.onSocketGone(ws);
      }
    }
  }

  private handleTyping(side: Side, on: boolean) {
    if (this.loadMatch().status !== "active") return;
    // A trailing "off" always goes through so the indicator can't stick.
    if (on && !this.limiter.take(side, "typing", Date.now())) return;
    for (const ws of this.socketsFor(engine.otherSide(side))) {
      this.sendTo(ws, { t: "typing", on });
    }
  }

  // --- Ops ----------------------------------------------------------------

  private async handleOp(ws: WebSocket, side: Side, frame: RoomOpFrame) {
    // A retry of a send whose ack was lost: answer with the stored message
    // instead of writing a duplicate.
    if (frame.t === "send") {
      const existing = this.findSend(side, frame.id);
      if (existing !== null) {
        this.sendTo(ws, {
          t: "ack",
          id: frame.id,
          messageId: String(existing),
        });
        return;
      }
    }
    const now = Date.now();
    const match = this.loadMatch();
    const ctx: OpContext = { match, side, now };
    const result = this.dispatch(ctx, frame);

    if (!result.ok) {
      this.sendTo(ws, { t: "err", id: frame.id, code: result.code });
      return;
    }
    if (result.charge && !this.limiter.take(side, result.charge, now)) {
      this.sendTo(ws, { t: "err", id: frame.id, code: "rate_limited" });
      return;
    }

    // All writes below are synchronous SQL with no await in between, so they
    // commit together.
    let inserted: MessageRow | null = null;
    if (result.match) this.saveMatch(result.match);
    if (result.insert) {
      inserted = this.insertMessage(
        result.insert,
        frame.t === "send" ? frame.id : null,
      );
    }
    if (result.update) this.updateMessage(result.update);
    if (result.burnAt && result.update) {
      this.setTimer("burn", result.update.seq, result.burnAt);
    }
    if (result.ended) this.scheduleEnd(now);
    if (result.burnAt || result.ended) await this.syncAlarm();

    this.sendTo(ws, {
      t: "ack",
      id: frame.id,
      ...(frame.t === "send" && inserted
        ? { messageId: String(inserted.seq) }
        : {}),
    });

    const changed = [inserted, result.update ?? null].filter(
      (m): m is MessageRow => m !== null,
    );
    if (changed.length > 0) {
      this.broadcastMessages(
        changed,
        inserted && frame.t === "send" ? { [inserted.seq]: frame.id } : {},
      );
    }
    if (result.match) this.broadcastMeta();
  }

  private dispatch(ctx: OpContext, frame: RoomOpFrame): OpResult {
    switch (frame.t) {
      case "send":
        return engine.send(ctx, {
          text: frame.text,
          whisper: frame.whisper,
          effect: frame.effect,
          replyTarget: frame.replyTo
            ? this.getMessage(Number(frame.replyTo))
            : null,
          messageCount: this.messageCount(),
        });
      case "react":
        return engine.react(
          ctx,
          this.getMessage(Number(frame.messageId)),
          frame.emoji,
        );
      case "viewWhisper":
        return engine.viewWhisper(
          ctx,
          this.getMessage(Number(frame.messageId)),
        );
      case "dealCard":
        return engine.dealCard(ctx, frame.cardId, frame.mode);
      case "answerCard":
        return engine.answerCard(ctx, frame.cardId, frame.pick);
      case "dismissGame":
        return engine.dismissGame(ctx);
      case "stayConnected":
        return engine.stayConnected(ctx);
      case "submitReveal":
        return engine.submitReveal(ctx, frame.handle);
      case "withdrawReveal":
        return engine.withdrawReveal(ctx);
      case "leave":
        return engine.leave(ctx);
    }
  }

  // --- Timers -------------------------------------------------------------

  private async runTimers(now: number) {
    if (!this.loadCreds()) return;
    const due = this.sql
      .exec<{ kind: string; ref: number }>(
        "SELECT kind, ref FROM timers WHERE at <= ?",
        now,
      )
      .toArray();
    for (const { kind, ref } of due) {
      this.clearTimer(kind as TimerKind, ref);
      switch (kind as TimerKind) {
        case "purge":
          await this.purge();
          return;
        case "start": {
          const match = this.loadMatch();
          if (match.status === "active" && !engine.bothSeen(match)) {
            this.endWithoutLeaver(now);
          }
          break;
        }
        case "away": {
          const side: Side = ref === 0 ? "a" : "b";
          const match = this.loadMatch();
          if (match.status === "active" && this.socketsFor(side).length === 0) {
            this.endWithoutLeaver(now);
          }
          break;
        }
        case "burn": {
          const burned = engine.burnWhisper(this.getMessage(ref));
          if (burned) {
            this.updateMessage(burned);
            this.broadcastMessages([burned]);
          }
          break;
        }
        case "sweep": {
          await this.closeStaleSockets(now);
          const match = this.loadMatch();
          if (match.status !== "active") break;
          const lastAt =
            this.sql
              .exec<{ at: number | null }>(
                "SELECT MAX(created_at) AS at FROM messages",
              )
              .one().at ?? match.createdAt;
          if (now - lastAt >= IDLE_MATCH_MS) this.endWithoutLeaver(now);
          else this.setTimer("sweep", 0, now + SWEEP_INTERVAL_MS);
          break;
        }
      }
    }
    await this.syncAlarm();
  }

  private endWithoutLeaver(now: number) {
    this.saveMatch(engine.endMatch(this.loadMatch(), now, null));
    this.scheduleEnd(now);
    this.broadcastMeta();
  }

  /** The match just ended: drop the liveness timers, schedule the purge and
   *  take the match off the lobby's headcount. */
  private scheduleEnd(now: number) {
    this.sql.exec(
      "DELETE FROM timers WHERE kind IN ('start', 'away', 'sweep')",
    );
    this.setTimer("purge", 0, now + GRACE_MS);
    this.reportEnded();
  }

  /** Best effort: a lost report is pruned by the lobby after
   *  MAX_TRACKED_MATCH_MS. */
  private reportEnded() {
    const matchId = this.creds?.matchId;
    // Rooms created before the headcount existed have no lobby_id column,
    // and the lobby never counted them.
    const hasColumn =
      this.sql
        .exec(
          "SELECT 1 FROM pragma_table_info('match') WHERE name = 'lobby_id'",
        )
        .toArray().length > 0;
    const lobbyId = hasColumn
      ? this.sql
          .exec<{ lobby_id: string | null }>(
            "SELECT lobby_id FROM match WHERE id = 1",
          )
          .one().lobby_id
      : null;
    if (!matchId || !lobbyId) return;
    this.ctx.waitUntil(
      (async () => {
        try {
          const lobby = this.env.CHAT_LOBBY.get(
            this.env.CHAT_LOBBY.idFromString(lobbyId),
          );
          await lobby.roomEnded(matchId);
        } catch (err) {
          this.report(err, "report-ended");
        }
      })(),
    );
  }

  private async purge() {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.close(CLOSE.GONE, "gone");
      } catch {
        // Already closing.
      }
    }
    // Also clears the alarm (compat date >= 2026-02-24).
    await this.ctx.storage.deleteAll();
    this.creds = null;
    this.match = undefined;
    this.alarmAt = null;
  }

  /** `keepExisting` leaves an earlier deadline in place (INSERT OR IGNORE), so
   *  repeated disconnects can't push an away grace further out. */
  private setTimer(
    kind: TimerKind,
    ref: number,
    at: number,
    keepExisting = false,
  ) {
    this.sql.exec(
      `INSERT OR ${keepExisting ? "IGNORE" : "REPLACE"} INTO timers (kind, ref, at) VALUES (?, ?, ?)`,
      kind,
      ref,
      at,
    );
  }

  private clearTimer(kind: TimerKind, ref: number) {
    this.sql.exec("DELETE FROM timers WHERE kind = ? AND ref = ?", kind, ref);
  }

  /** Points the single alarm at the earliest timer. Writes only when the
   *  deadline actually moves: every setAlarm is a billed row write. */
  private async syncAlarm() {
    const next =
      this.sql
        .exec<{ at: number | null }>("SELECT MIN(at) AS at FROM timers")
        .one().at ?? null;
    if (this.alarmAt === undefined) {
      this.alarmAt = await this.ctx.storage.getAlarm();
    }
    if (next === this.alarmAt) return;
    if (next === null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(next);
    this.alarmAt = next;
  }

  // --- Storage ------------------------------------------------------------

  private loadCreds(): Credentials | null {
    if (this.creds !== undefined) return this.creds;
    // Reading sqlite_master allocates nothing, so an unknown room stays empty.
    const exists = this.sql
      .exec(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'match'",
      )
      .toArray().length;
    const row = exists
      ? this.sql
          .exec<MatchRowSql>(
            "SELECT match_id, a_sid, a_hash, b_sid, b_hash, state FROM match WHERE id = 1",
          )
          .toArray()[0]
      : undefined;
    if (!row) {
      this.creds = null;
      return null;
    }
    this.creds = {
      matchId: row.match_id,
      aSid: row.a_sid,
      aHash: row.a_hash,
      bSid: row.b_sid,
      bHash: row.b_hash,
    };
    this.match = JSON.parse(row.state) as MatchState;
    return this.creds;
  }

  /** Only called once loadCreds() has confirmed the room exists. */
  private loadMatch(): MatchState {
    if (!this.match) this.loadCreds();
    if (!this.match) throw new Error("chat room has no match row");
    return this.match;
  }

  private saveMatch(match: MatchState) {
    this.sql.exec(
      "UPDATE match SET state = ? WHERE id = 1",
      JSON.stringify(match),
    );
    this.match = match;
  }

  private getMessage(seq: number): MessageRow | null {
    if (!Number.isSafeInteger(seq)) return null;
    const row = this.sql
      .exec<MessageRowSql>(
        `SELECT ${MESSAGE_COLUMNS} FROM messages WHERE seq = ?`,
        seq,
      )
      .toArray()[0];
    return row ? toMessage(row) : null;
  }

  /** Rowids are never reused or deleted individually, so the max is the count. */
  private messageCount(): number {
    return (
      this.sql
        .exec<{ n: number | null }>("SELECT MAX(seq) AS n FROM messages")
        .one().n ?? 0
    );
  }

  private findSend(side: Side, clientId: string): number | null {
    const row = this.sql
      .exec<{ seq: number }>(
        "SELECT seq FROM messages WHERE seq > ? AND author = ? AND client_id = ?",
        this.messageCount() - SEND_DEDUPE_WINDOW,
        side,
        clientId,
      )
      .toArray()[0];
    return row ? row.seq : null;
  }

  private insertMessage(m: NewMessage, clientId: string | null): MessageRow {
    const { seq } = this.sql
      .exec<{ seq: number }>(
        `INSERT INTO messages (author, text, reaction_a, reaction_b, reply_to, kind, whisper_viewed_at, burned, game, effect, created_at, client_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING seq`,
        m.author,
        m.text,
        m.reactionA,
        m.reactionB,
        m.replyTo,
        m.kind,
        m.whisperViewedAt,
        m.burned ? 1 : 0,
        m.game ? JSON.stringify(m.game) : null,
        m.effect,
        m.createdAt,
        clientId,
      )
      .one();
    return { ...m, seq };
  }

  private updateMessage(m: MessageRow) {
    this.sql.exec(
      `UPDATE messages SET text = ?, reaction_a = ?, reaction_b = ?, whisper_viewed_at = ?, burned = ? WHERE seq = ?`,
      m.text,
      m.reactionA,
      m.reactionB,
      m.whisperViewedAt,
      m.burned ? 1 : 0,
      m.seq,
    );
  }

  private recentMessages(viewer: Side) {
    const raw = this.sql
      .exec<MessageRowSql>(
        `SELECT ${MESSAGE_COLUMNS} FROM (SELECT ${MESSAGE_COLUMNS} FROM messages ORDER BY seq DESC LIMIT ?) ORDER BY seq`,
        MESSAGE_CAP,
      )
      .toArray();
    const clientIds = new Map(raw.map((r) => [r.seq, r.client_id]));
    const rows = raw.map(toMessage);
    const bySeq = new Map(rows.map((r) => [r.seq, r]));
    const missing = [
      ...new Set(
        rows
          .map((r) => r.replyTo)
          .filter((s): s is number => s !== null && !bySeq.has(s)),
      ),
    ];
    if (missing.length > 0) {
      const targets = this.sql
        .exec<MessageRowSql>(
          `SELECT ${MESSAGE_COLUMNS} FROM messages WHERE seq IN (${missing.map(() => "?").join(",")})`,
          ...missing,
        )
        .toArray();
      for (const t of targets) bySeq.set(t.seq, toMessage(t));
    }
    return rows.map((r) =>
      projectMessage(
        r,
        viewer,
        r.replyTo ? (bySeq.get(r.replyTo) ?? null) : null,
        clientIds.get(r.seq),
      ),
    );
  }

  // --- Frames -------------------------------------------------------------

  private attachment(ws: WebSocket): Attachment {
    return (
      (ws.deserializeAttachment() as Attachment | null) ?? {
        side: null,
        connectedAt: 0,
      }
    );
  }

  /** Open, authenticated sockets for a side, optionally excluding one. */
  private socketsFor(side: Side, except?: WebSocket): WebSocket[] {
    return this.ctx
      .getWebSockets()
      .filter(
        (ws) =>
          ws !== except &&
          ws.readyState === WebSocket.OPEN &&
          this.attachment(ws).side === side,
      );
  }

  private metaFor(viewer: Side, except?: WebSocket) {
    const match = this.loadMatch();
    const partner = engine.otherSide(viewer);
    return projectMeta(
      match,
      viewer,
      this.socketsFor(partner, except).length > 0,
      this.creds?.matchId ?? "",
    );
  }

  private broadcastMeta(only?: Side, except?: WebSocket) {
    for (const side of only ? [only] : (["a", "b"] as const)) {
      const meta = this.metaFor(side, except);
      for (const ws of this.socketsFor(side, except)) {
        this.sendTo(ws, { t: "meta", meta });
      }
    }
  }

  private broadcastMessages(
    rows: MessageRow[],
    clientIds: Record<number, string> = {},
  ) {
    for (const side of ["a", "b"] as const) {
      const sockets = this.socketsFor(side);
      if (sockets.length === 0) continue;
      const messages = rows.map((r) =>
        projectMessage(
          r,
          side,
          r.replyTo ? this.getMessage(r.replyTo) : null,
          clientIds[r.seq],
        ),
      );
      for (const ws of sockets) this.sendTo(ws, { t: "msgs", messages });
    }
  }

  private sendTo(ws: WebSocket, frame: RoomServerFrame) {
    try {
      ws.send(JSON.stringify(frame));
    } catch {
      // The socket closed between the check and the send.
    }
  }

  private report(err: unknown, where: string) {
    // Never include frame contents, handles or session ids.
    captureServerException(this.env, (p) => this.ctx.waitUntil(p), err, {
      properties: { where: `chat-room:${where}` },
    });
  }
}
