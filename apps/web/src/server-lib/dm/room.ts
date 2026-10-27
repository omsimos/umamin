/**
 * DmRoom: one Durable Object per direct-message conversation, named
 * `dm:v1:${lowId}:${highId}` (lib/dm/pair.ts).
 *
 * The rules live in lib/dm/engine.ts; this class only loads and saves rows,
 * moves frames and keeps the Turso thread index in step. Cost rules that shape
 * it (docs: the DM plan's architecture section):
 * - Sockets use the Hibernation API and pings are answered by the runtime's
 *   auto-response, so an idle conversation is evicted and costs nothing.
 * - Memory is a cache only. Everything is rebuilt from SQLite and socket
 *   attachments after hibernation.
 * - One message is one row written: rowid primary key, no AUTOINCREMENT, no
 *   secondary index. Message text is AES-encrypted like anonymous messages.
 * - The Turso `dm_thread` row is written at once only when what a Chats list
 *   shows changes (lib/dm/engine.ts threadSyncUrgency); otherwise one alarm
 *   coalesces a busy stretch into a single write.
 * - Storage is created on the first message. Opening a conversation that has
 *   none writes nothing.
 *
 * The Worker route (api/dm-socket.ts) authenticates the viewer and checks
 * access before forwarding the upgrade, and passes the result in headers only
 * it can set.
 */

import { DurableObject } from "cloudflare:workers";
import { aesDecrypt, aesEncrypt } from "@umamin/encryption";
import { SideLimiter } from "../../lib/chat/limits";
import {
  ACCESS_RECHECK_MS,
  DM_DEDUPE_WINDOW,
  DM_PAGE_SIZE,
  DM_STALE_SOCKET_MS,
  MAX_DM_FRAME_CHARS,
  MAX_SOCKETS_PER_SIDE,
  PUSH_COOLDOWN_MS,
  REPORT_CONTEXT,
  REPORT_COOLDOWN_MS,
  THREAD_SYNC_DEBOUNCE_MS,
} from "../../lib/dm/constants";
import type { DmRow, NewDmRow, ThreadSnapshot } from "../../lib/dm/engine";
import * as engine from "../../lib/dm/engine";
import {
  type DmPair,
  type DmSide,
  otherDmSide,
  parseThreadId,
  userAt,
} from "../../lib/dm/pair";
import {
  CLOSE,
  DM_CLOSED,
  DM_PROTOCOL_VERSION,
  type DmFrame,
  type DmServerFrame,
  dmFrameSchema,
  PING,
  PONG,
  parseFrame,
} from "../../lib/dm/protocol";
import type { DmMessage, DmMeta } from "../../lib/dm/types";
import type { AppEnv } from "../env";
import { captureServerException } from "../posthog";
import { type DmStore, tursoDmStore } from "./store";

/** Set by the Worker route only; a browser can't reach the object directly. */
export const DM_HEADERS = {
  thread: "x-umamin-dm-thread",
  user: "x-umamin-dm-user",
  canSend: "x-umamin-dm-can-send",
} as const;

interface Attachment {
  threadId: string;
  side: DmSide;
  /** Sent the `hi` frame with a matching protocol version. */
  ready: boolean;
  canSend: boolean;
  checkedAt: number;
  connectedAt: number;
}

interface RoomState {
  pair: DmPair;
  read: [number, number];
  hidden: [number, number];
  pushAt: [number, number];
  reportAt: [number, number];
  synced: ThreadSnapshot | null;
}

type MessageRowSql = {
  seq: number;
  author: number;
  body: string | null;
  reply_to: number | null;
  reaction_low: string | null;
  reaction_high: string | null;
  created_at: number;
  client_id: string | null;
};

const MESSAGE_COLUMNS =
  "seq, author, body, reply_to, reaction_low, reaction_high, created_at, client_id";

const LIMITER_KEY: Record<DmSide, string> = { 0: "low", 1: "high" };

async function toRow(r: MessageRowSql): Promise<DmRow> {
  return {
    seq: r.seq,
    author: r.author === 1 ? 1 : 0,
    text: r.body === null ? null : await aesDecrypt(r.body),
    replyTo: r.reply_to,
    reactionLow: r.reaction_low,
    reactionHigh: r.reaction_high,
    createdAt: r.created_at,
  };
}

export class DmRoom extends DurableObject<AppEnv> {
  private readonly sql: SqlStorage;
  private readonly limiter = new SideLimiter();
  // Caches, rebuilt lazily after hibernation.
  private state: RoomState | null | undefined;
  private alarmAt: number | null | undefined;
  private storeImpl: DmStore | null = null;
  /** Thread-row writes run one at a time, each with the latest snapshot. */
  private syncChain: Promise<void> = Promise.resolve();

  constructor(ctx: DurableObjectState, env: AppEnv) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
  }

  /** Test seam: the workerd pool can't run libSQL. */
  __setStore(store: DmStore) {
    this.storeImpl = store;
  }

  private store(): DmStore {
    this.storeImpl ??= tursoDmStore(this.env);
    return this.storeImpl;
  }

  // --- Sockets ------------------------------------------------------------

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    const pair = parseThreadId(request.headers.get(DM_HEADERS.thread) ?? "");
    const userId = request.headers.get(DM_HEADERS.user) ?? "";
    const side =
      pair && userId === pair.lowId
        ? 0
        : pair && userId === pair.highId
          ? 1
          : null;

    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    const now = Date.now();
    if (!pair || side === null || !this.pairMatches(pair)) {
      server.serializeAttachment(null);
      server.close(CLOSE.UNAUTHORIZED, "unauthorized");
      return new Response(null, { status: 101, webSocket: client });
    }
    server.serializeAttachment({
      threadId: pair.threadId,
      side,
      ready: false,
      canSend: request.headers.get(DM_HEADERS.canSend) === "1",
      checkedAt: now,
      connectedAt: now,
    } satisfies Attachment);
    if (this.socketsFor(side, server).length >= MAX_SOCKETS_PER_SIDE) {
      server.close(CLOSE.TOO_MANY, "too many");
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    try {
      const att = this.attachment(ws);
      if (!att) {
        ws.close(CLOSE.UNAUTHORIZED, "unauthorized");
        return;
      }
      const frame = parseFrame<DmFrame>(dmFrameSchema, raw, MAX_DM_FRAME_CHARS);
      if (!frame) {
        ws.close(CLOSE.BAD_FRAME, "bad frame");
        return;
      }
      if (frame.t === "hi") {
        await this.handleHi(ws, att, frame.v);
        return;
      }
      if (!att.ready) {
        ws.close(CLOSE.UNAUTHORIZED, "unauthorized");
        return;
      }
      await this.handleFrame(ws, att, frame);
      // The object is awake anyway, so closing half-open sockets here is free.
      this.closeStaleSockets(Date.now());
    } catch (err) {
      this.report(err, "message");
    }
  }

  async webSocketClose(ws: WebSocket) {
    try {
      this.onSocketGone(ws);
    } catch (err) {
      this.report(err, "close");
    }
  }

  async webSocketError(ws: WebSocket) {
    try {
      this.onSocketGone(ws);
    } catch (err) {
      this.report(err, "error");
    }
  }

  async alarm() {
    this.alarmAt = null;
    try {
      await this.syncThread(true);
    } catch (err) {
      this.report(err, "alarm");
      // Rethrow so the runtime retries; a thread write is idempotent.
      throw err;
    }
  }

  // --- RPC from the Worker -------------------------------------------------

  /** A block closes the conversation for both sides at once. An unfollow
   *  keeps it readable but stops sending. */
  async sever(kind: "block" | "unfollow"): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) {
      const att = this.attachment(ws);
      if (!att) continue;
      if (kind === "block") {
        this.closeQuietly(ws, DM_CLOSED, "closed");
        continue;
      }
      if (!att.canSend) continue;
      const next = { ...att, canSend: false, checkedAt: Date.now() };
      ws.serializeAttachment(next);
      if (next.ready) this.sendTo(ws, { t: "meta", meta: this.metaFor(next) });
    }
  }

  /** "Delete chat" for one side: hides everything so far from that side only
   *  and marks it read. A later message shows the thread again. */
  async hide(userId: string): Promise<void> {
    const st = this.loadState();
    if (!st) return;
    const side =
      userId === st.pair.lowId ? 0 : userId === st.pair.highId ? 1 : null;
    if (side === null) return;
    const last = this.lastSeq();
    if (st.hidden[side] >= last) return;
    st.hidden[side] = last;
    st.read[side] = Math.max(st.read[side], last);
    this.saveMeta(`hidden${side}`, last);
    this.saveMeta(`read${side}`, st.read[side]);
    for (const ws of this.socketsFor(side)) {
      const att = this.attachment(ws);
      if (att?.ready) await this.sendSync(ws, att);
    }
    await this.syncThread(true);
  }

  /** A participant deleted their account: drop everything. */
  async purge(): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) {
      this.closeQuietly(ws, DM_CLOSED, "closed");
    }
    await this.ctx.storage.deleteAll();
    this.state = null;
    this.alarmAt = null;
  }

  // --- Frames -------------------------------------------------------------

  private async handleHi(ws: WebSocket, att: Attachment, version: number) {
    if (version !== DM_PROTOCOL_VERSION) {
      ws.close(CLOSE.VERSION, "version");
      return;
    }
    const wasOnline = this.liveSockets(att.side, ws).length > 0;
    const next = { ...att, ready: true };
    ws.serializeAttachment(next);
    await this.sendSync(ws, next);
    if (!wasOnline) this.broadcastMeta(otherDmSide(att.side));
  }

  private async handleFrame(
    ws: WebSocket,
    att: Attachment,
    frame: Exclude<DmFrame, { t: "hi" }>,
  ) {
    const now = Date.now();
    switch (frame.t) {
      case "typing":
        // A trailing "off" always goes through so the indicator can't stick.
        if (
          frame.on &&
          !this.limiter.take(LIMITER_KEY[att.side], "typing", now)
        ) {
          return;
        }
        for (const peer of this.socketsFor(otherDmSide(att.side))) {
          this.sendTo(peer, { t: "typing", on: frame.on });
        }
        return;
      case "read":
        await this.handleRead(att.side, Number(frame.upTo));
        return;
      case "history":
        await this.handleHistory(ws, att.side, frame.id, Number(frame.before));
        return;
      case "report":
        await this.handleReport(ws, att.side, frame);
        return;
      default:
        await this.handleOp(ws, att, frame, now);
    }
  }

  private async handleOp(
    ws: WebSocket,
    att: Attachment,
    frame: Extract<DmFrame, { t: "send" } | { t: "react" } | { t: "unsend" }>,
    now: number,
  ) {
    const side = att.side;
    // A retry of a send whose ack was lost: answer with the stored message.
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

    const canSend =
      frame.t === "unsend"
        ? att.canSend
        : await this.recheckAccess(ws, att, now);
    const ctx = { side, now, canSend };
    let result: engine.DmOpResult;
    let charge: "sendMessage" | "react";
    if (frame.t === "send") {
      charge = "sendMessage";
      result = engine.send(ctx, {
        text: frame.text,
        wantsReply: frame.replyTo !== undefined,
        replyTarget: frame.replyTo
          ? await this.getRow(Number(frame.replyTo))
          : null,
      });
    } else if (frame.t === "react") {
      charge = "react";
      result = engine.react(
        ctx,
        await this.getRow(Number(frame.messageId)),
        frame.emoji,
      );
    } else {
      charge = "react";
      result = engine.unsend(ctx, await this.getRow(Number(frame.messageId)));
    }

    if (!result.ok) {
      this.sendTo(ws, { t: "err", id: frame.id, code: result.code });
      return;
    }
    if (!this.limiter.take(LIMITER_KEY[side], charge, now)) {
      this.sendTo(ws, { t: "err", id: frame.id, code: "rate_limited" });
      return;
    }

    let inserted: DmRow | null = null;
    if (result.insert) {
      inserted = await this.insertRow(
        att.threadId,
        result.insert,
        frame.t === "send" ? frame.id : null,
      );
    }
    if (result.update) await this.updateRow(result.update);

    this.sendTo(ws, {
      t: "ack",
      id: frame.id,
      ...(inserted ? { messageId: String(inserted.seq) } : {}),
    });

    const changed = [inserted, result.update ?? null].filter(
      (r): r is DmRow => r !== null,
    );
    if (changed.length > 0) {
      await this.broadcastRows(
        changed,
        inserted && frame.t === "send" ? { [inserted.seq]: frame.id } : {},
      );
    }
    if (inserted) this.maybePush(side, now);
    if (changed.length > 0) await this.syncThread(false);
  }

  private async handleRead(side: DmSide, upTo: number) {
    const st = this.loadState();
    if (!st) return;
    const next = engine.nextReadSeq(st.read[side], upTo, this.lastSeq());
    if (next === null) return;
    st.read[side] = next;
    this.saveMeta(`read${side}`, next);
    this.broadcastMeta(otherDmSide(side));
    await this.syncThread(false);
  }

  private async handleHistory(
    ws: WebSocket,
    side: DmSide,
    id: string,
    before: number,
  ) {
    const { messages, hasMore } = await this.page(side, before);
    this.sendTo(ws, { t: "history", id, messages, hasMore });
  }

  private async handleReport(
    ws: WebSocket,
    side: DmSide,
    frame: Extract<DmFrame, { t: "report" }>,
  ) {
    const st = this.loadState();
    const now = Date.now();
    if (!st) {
      this.sendTo(ws, { t: "err", id: frame.id, code: "not_found" });
      return;
    }
    if (now - st.reportAt[side] < REPORT_COOLDOWN_MS) {
      this.sendTo(ws, { t: "err", id: frame.id, code: "rate_limited" });
      return;
    }
    const seq = Number(frame.messageId);
    const target = await this.getRow(seq);
    const context = await this.rowsBefore(seq, REPORT_CONTEXT);
    const built = engine.buildReportSnapshot(side, target, context);
    if (!built.ok) {
      this.sendTo(ws, { t: "err", id: frame.id, code: built.code });
      return;
    }
    const stored = await this.store().insertReport({
      reporterId: userAt(st.pair, side),
      reportedId: userAt(st.pair, otherDmSide(side)),
      threadId: st.pair.threadId,
      messageSeq: seq,
      reason: frame.reason,
      entries: built.entries,
    });
    if (!stored) {
      this.sendTo(ws, { t: "err", id: frame.id, code: "reported" });
      return;
    }
    st.reportAt[side] = now;
    this.saveMeta(`reportAt${side}`, now);
    this.sendTo(ws, { t: "ack", id: frame.id });
  }

  /** Re-checks mutual follow and blocks once per ACCESS_RECHECK_MS, then
   *  shares the answer with every open socket. */
  private async recheckAccess(
    ws: WebSocket,
    att: Attachment,
    now: number,
  ): Promise<boolean> {
    if (now - att.checkedAt < ACCESS_RECHECK_MS) return att.canSend;
    const pair = parseThreadId(att.threadId);
    if (!pair) return false;
    const canSend = await this.store().canMessage(pair);
    for (const socket of this.ctx.getWebSockets()) {
      const a = socket === ws ? att : this.attachment(socket);
      if (!a) continue;
      const next = { ...a, canSend, checkedAt: now };
      socket.serializeAttachment(next);
      if (a.canSend !== canSend && next.ready) {
        this.sendTo(socket, { t: "meta", meta: this.metaFor(next) });
      }
    }
    return canSend;
  }

  /** Push only when the recipient has no live socket here, at most once per
   *  PUSH_COOLDOWN_MS. */
  private maybePush(sender: DmSide, now: number) {
    const st = this.loadState();
    if (!st) return;
    const recipient = otherDmSide(sender);
    if (this.liveSockets(recipient).length > 0) return;
    if (now - st.pushAt[recipient] < PUSH_COOLDOWN_MS) return;
    st.pushAt[recipient] = now;
    this.saveMeta(`pushAt${recipient}`, now);
    const store = this.store();
    this.ctx.waitUntil(
      store
        .pushMessage(userAt(st.pair, recipient), userAt(st.pair, sender))
        .catch((err) => this.report(err, "push")),
    );
  }

  // --- Thread index -------------------------------------------------------

  private async snapshot(st: RoomState): Promise<ThreadSnapshot> {
    const raw = this.sql
      .exec<MessageRowSql>(
        `SELECT ${MESSAGE_COLUMNS} FROM messages ORDER BY seq DESC LIMIT 1`,
      )
      .toArray()[0];
    const last = raw ? await toRow(raw) : null;
    return {
      lastSeq: last?.seq ?? 0,
      lastAt: last?.createdAt ?? 0,
      lastSender: last?.author ?? null,
      preview: engine.previewOf(last?.text ?? null),
      readSeq: [st.read[0], st.read[1]],
      hiddenSeq: [st.hidden[0], st.hidden[1]],
    };
  }

  /** Writes the Turso row now when the change is visible in a Chats list (or
   *  `force`), otherwise arms the debounce alarm. */
  private syncThread(force: boolean): Promise<void> {
    const run = this.syncChain.then(async () => {
      const st = this.loadState();
      if (!st) return;
      const next = await this.snapshot(st);
      const urgency = engine.threadSyncUrgency(st.synced, next);
      if (urgency === "none") return;
      if (urgency === "later" && !force) {
        await this.armSync();
        return;
      }
      try {
        await this.store().writeThread(st.pair, next);
      } catch (err) {
        // Retried by the alarm; the room keeps working without the index.
        this.report(err, "thread-sync");
        await this.armSync();
        return;
      }
      st.synced = next;
      this.saveMeta("synced", JSON.stringify(next));
    });
    // A failed run must not wedge every later one.
    this.syncChain = run.catch(() => {});
    return run;
  }

  /** Arms the debounce alarm unless one is already pending, so a busy
   *  stretch can't keep pushing the write further out. */
  private async armSync() {
    if (this.alarmAt === undefined) {
      this.alarmAt = await this.ctx.storage.getAlarm();
    }
    if (this.alarmAt !== null) return;
    const at = Date.now() + THREAD_SYNC_DEBOUNCE_MS;
    await this.ctx.storage.setAlarm(at);
    this.alarmAt = at;
  }

  // --- Storage ------------------------------------------------------------

  private hasSchema(): boolean {
    // Reading sqlite_master allocates nothing, so an unused room stays empty.
    return (
      this.sql
        .exec(
          "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'meta'",
        )
        .toArray().length > 0
    );
  }

  private ensureSchema(threadId: string) {
    if (this.loadState()) return;
    const pair = parseThreadId(threadId);
    if (!pair) throw new Error("dm room has no valid thread id");
    // Rowid primary key, no AUTOINCREMENT: rows are only ever removed all at
    // once by deleteAll(), so seq stays monotonic without the extra write.
    this.sql.exec(`CREATE TABLE IF NOT EXISTS messages (
      seq INTEGER PRIMARY KEY,
      author INTEGER NOT NULL, body TEXT, reply_to INTEGER,
      reaction_low TEXT, reaction_high TEXT,
      created_at INTEGER NOT NULL, client_id TEXT)`);
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)",
    );
    this.saveMeta("thread", pair.threadId);
    this.state = {
      pair,
      read: [0, 0],
      hidden: [0, 0],
      pushAt: [0, 0],
      reportAt: [0, 0],
      synced: null,
    };
  }

  /** A room only ever serves the pair it was created for. */
  private pairMatches(pair: DmPair): boolean {
    const st = this.loadState();
    return !st || st.pair.threadId === pair.threadId;
  }

  private loadState(): RoomState | null {
    if (this.state !== undefined) return this.state;
    if (!this.hasSchema()) {
      this.state = null;
      return null;
    }
    const meta = new Map(
      this.sql
        .exec<{ k: string; v: string }>("SELECT k, v FROM meta")
        .toArray()
        .map((r) => [r.k, r.v]),
    );
    const pair = parseThreadId(meta.get("thread") ?? "");
    if (!pair) {
      this.state = null;
      return null;
    }
    const num = (k: string) => Number(meta.get(k) ?? 0) || 0;
    const synced = meta.get("synced");
    this.state = {
      pair,
      read: [num("read0"), num("read1")],
      hidden: [num("hidden0"), num("hidden1")],
      pushAt: [num("pushAt0"), num("pushAt1")],
      reportAt: [num("reportAt0"), num("reportAt1")],
      synced: synced ? (JSON.parse(synced) as ThreadSnapshot) : null,
    };
    return this.state;
  }

  private saveMeta(k: string, v: string | number) {
    this.sql.exec(
      "INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)",
      k,
      String(v),
    );
  }

  private lastSeq(): number {
    if (!this.loadState()) return 0;
    return (
      this.sql
        .exec<{ n: number | null }>("SELECT MAX(seq) AS n FROM messages")
        .one().n ?? 0
    );
  }

  private async getRow(seq: number): Promise<DmRow | null> {
    if (!Number.isSafeInteger(seq) || !this.loadState()) return null;
    const raw = this.sql
      .exec<MessageRowSql>(
        `SELECT ${MESSAGE_COLUMNS} FROM messages WHERE seq = ?`,
        seq,
      )
      .toArray()[0];
    return raw ? toRow(raw) : null;
  }

  private async rowsBefore(seq: number, limit: number): Promise<DmRow[]> {
    if (!this.loadState()) return [];
    const raw = this.sql
      .exec<MessageRowSql>(
        `SELECT ${MESSAGE_COLUMNS} FROM messages WHERE seq < ? ORDER BY seq DESC LIMIT ?`,
        seq,
        limit,
      )
      .toArray();
    return (await Promise.all(raw.map(toRow))).reverse();
  }

  private findSend(side: DmSide, clientId: string): number | null {
    if (!this.loadState()) return null;
    const row = this.sql
      .exec<{ seq: number }>(
        "SELECT seq FROM messages WHERE seq > ? AND author = ? AND client_id = ?",
        this.lastSeq() - DM_DEDUPE_WINDOW,
        side,
        clientId,
      )
      .toArray()[0];
    return row ? row.seq : null;
  }

  private async insertRow(
    threadId: string,
    m: NewDmRow,
    clientId: string | null,
  ): Promise<DmRow> {
    const body = m.text === null ? null : await aesEncrypt(m.text);
    // No await between the schema check and the insert, so they commit
    // together.
    this.ensureSchema(threadId);
    const { seq } = this.sql
      .exec<{ seq: number }>(
        `INSERT INTO messages (author, body, reply_to, reaction_low, reaction_high, created_at, client_id)
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING seq`,
        m.author,
        body,
        m.replyTo,
        m.reactionLow,
        m.reactionHigh,
        m.createdAt,
        clientId,
      )
      .one();
    return { ...m, seq };
  }

  private async updateRow(m: DmRow) {
    const body = m.text === null ? null : await aesEncrypt(m.text);
    this.sql.exec(
      "UPDATE messages SET body = ?, reaction_low = ?, reaction_high = ? WHERE seq = ?",
      body,
      m.reactionLow,
      m.reactionHigh,
      m.seq,
    );
  }

  /** Newest page below `before` (exclusive), oldest first, skipping what the
   *  viewer hid. */
  private async page(
    viewer: DmSide,
    before: number,
  ): Promise<{ messages: DmMessage[]; hasMore: boolean }> {
    const st = this.loadState();
    if (!st) return { messages: [], hasMore: false };
    const raw = this.sql
      .exec<MessageRowSql>(
        `SELECT ${MESSAGE_COLUMNS} FROM messages WHERE seq < ? AND seq > ? ORDER BY seq DESC LIMIT ?`,
        before,
        st.hidden[viewer],
        DM_PAGE_SIZE + 1,
      )
      .toArray();
    const hasMore = raw.length > DM_PAGE_SIZE;
    const pageRaw = raw.slice(0, DM_PAGE_SIZE).reverse();
    const rows = await Promise.all(pageRaw.map(toRow));
    return {
      messages: await this.project(rows, viewer, pageRaw),
      hasMore,
    };
  }

  /** Projects rows for one viewer, loading reply targets missing from the
   *  batch in one query. */
  private async project(
    rows: DmRow[],
    viewer: DmSide,
    raw: { seq: number; client_id: string | null }[] = [],
    clientIds: Record<number, string> = {},
  ): Promise<DmMessage[]> {
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
      for (const t of await Promise.all(targets.map(toRow))) {
        bySeq.set(t.seq, t);
      }
    }
    const storedIds = new Map(raw.map((r) => [r.seq, r.client_id]));
    return rows.map((r) =>
      engine.projectDmMessage(
        r,
        viewer,
        r.replyTo ? (bySeq.get(r.replyTo) ?? null) : null,
        clientIds[r.seq] ?? storedIds.get(r.seq),
      ),
    );
  }

  // --- Frames out ---------------------------------------------------------

  private async sendSync(ws: WebSocket, att: Attachment) {
    const { messages, hasMore } = await this.page(
      att.side,
      Number.MAX_SAFE_INTEGER,
    );
    this.sendTo(ws, { t: "sync", meta: this.metaFor(att), messages, hasMore });
  }

  private metaFor(att: Attachment): DmMeta {
    const peer = otherDmSide(att.side);
    return {
      peerOnline: this.liveSockets(peer).length > 0,
      peerReadSeq: this.loadState()?.read[peer] ?? 0,
      canSend: att.canSend,
    };
  }

  private broadcastMeta(side: DmSide, except?: WebSocket) {
    for (const ws of this.socketsFor(side, except)) {
      const att = this.attachment(ws);
      if (att?.ready) this.sendTo(ws, { t: "meta", meta: this.metaFor(att) });
    }
  }

  private async broadcastRows(
    rows: DmRow[],
    clientIds: Record<number, string> = {},
  ) {
    for (const side of [0, 1] as const) {
      const sockets = this.socketsFor(side).filter(
        (ws) => this.attachment(ws)?.ready,
      );
      if (sockets.length === 0) continue;
      const messages = await this.project(rows, side, [], clientIds);
      for (const ws of sockets) this.sendTo(ws, { t: "msgs", messages });
    }
  }

  private onSocketGone(ws: WebSocket) {
    const att = this.attachment(ws);
    if (!att?.ready) return;
    if (this.liveSockets(att.side, ws).length > 0) return;
    this.broadcastMeta(otherDmSide(att.side), ws);
  }

  private closeStaleSockets(now: number) {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      if (!this.isFresh(ws, now)) {
        this.closeQuietly(ws, CLOSE.NORMAL, "stale");
        this.onSocketGone(ws);
      }
    }
  }

  private isFresh(ws: WebSocket, now: number): boolean {
    const att = this.attachment(ws);
    if (!att) return false;
    const pongAt =
      this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? 0;
    return now - Math.max(pongAt, att.connectedAt) < DM_STALE_SOCKET_MS;
  }

  /** Open sockets for a side, optionally excluding one. */
  private socketsFor(side: DmSide, except?: WebSocket): WebSocket[] {
    return this.ctx
      .getWebSockets()
      .filter(
        (ws) =>
          ws !== except &&
          ws.readyState === WebSocket.OPEN &&
          this.attachment(ws)?.side === side,
      );
  }

  /** Sockets that count as "online": ready and recently ponged. A hibernated
   *  half-open socket must not suppress a push. */
  private liveSockets(side: DmSide, except?: WebSocket): WebSocket[] {
    const now = Date.now();
    return this.socketsFor(side, except).filter(
      (ws) => this.attachment(ws)?.ready && this.isFresh(ws, now),
    );
  }

  private attachment(ws: WebSocket): Attachment | null {
    return (ws.deserializeAttachment() as Attachment | null) ?? null;
  }

  private sendTo(ws: WebSocket, frame: DmServerFrame) {
    try {
      ws.send(JSON.stringify(frame));
    } catch {
      // The socket closed between the check and the send.
    }
  }

  private closeQuietly(ws: WebSocket, code: number, reason: string) {
    try {
      ws.close(code, reason);
    } catch {
      // Already closing.
    }
  }

  private report(err: unknown, where: string) {
    // Never include frame contents, user ids or message text.
    captureServerException(this.env, (p) => this.ctx.waitUntil(p), err, {
      properties: { where: `dm-room:${where}` },
    });
  }
}
