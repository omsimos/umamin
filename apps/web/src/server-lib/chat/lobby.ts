/**
 * ChatLobby: the single Durable Object that owns the Umamin Chat queue.
 *
 * A waiting user IS an open lobby socket. Each waiter lives in its socket's
 * attachment (which survives hibernation), so the lobby has no tables and
 * closing the socket is the dequeue. Pairing rules are in lib/chat/pairing.ts;
 * this class claims a pair, asks a fresh ChatRoom to initialize, and hands
 * both sockets the matchId.
 *
 * Cost: pings are runtime auto-responses, and the alarm is armed only while
 * a fallback pairing or a queue timeout is actually pending, so an empty or
 * one-person lobby sleeps.
 */
import { DurableObject } from "cloudflare:workers";
import {
  AUTH_DEADLINE_MS,
  MAX_FRAME_CHARS,
  MAX_QUEUE_WAIT_MS,
  SECOND,
} from "../../lib/chat/constants";
import { inviteCodeFor } from "../../lib/chat/invite";
import {
  type Joiner,
  newWaiter,
  nextFallbackAt,
  normalizeCode,
  normalizeIdentity,
  pickFallbackPairs,
  pickPartner,
  type Waiter,
} from "../../lib/chat/pairing";
import {
  CLOSE,
  type LobbyFrame,
  type LobbyServerFrame,
  lobbyFrameSchema,
  PING,
  PONG,
  PROTOCOL_VERSION,
  parseFrame,
} from "../../lib/chat/protocol";
import type { AppEnv } from "../env";
import { captureServerException } from "../posthog";
import type { RoomSeat } from "./room";
import { hashesEqual, hashSecret } from "./secret";

/** Room objects are created where this hints. Most users are in the
 *  Philippines; the hint only applies when an object is first created. */
export const CHAT_LOCATION_HINT: DurableObjectLocationHint = "apac-se";

/** Waiting sockets allowed per client IP. Loose because of shared NAT. */
const MAX_SOCKETS_PER_IP = 5;

interface QueuedSeat {
  waiter: Waiter;
  seat: RoomSeat;
}

type LobbyAttachment =
  | { state: "pending"; ipKey: string; connectedAt: number }
  | ({
      state: "waiting" | "pairing";
      ipKey: string;
      connectedAt: number;
    } & QueuedSeat);

export class ChatLobby extends DurableObject<AppEnv> {
  private alarmAt: number | null | undefined;

  constructor(ctx: DurableObjectState, env: AppEnv) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    // Set by the Worker route from the canonical client IP. Only the Worker
    // can reach this object, so the header can't be forged by a client.
    const ipKey = request.headers.get("x-umamin-ip") ?? "unknown";
    const now = Date.now();
    this.closeExpiredPending(now);

    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({
      state: "pending",
      ipKey,
      connectedAt: now,
    } satisfies LobbyAttachment);
    const fromIp = this.ctx
      .getWebSockets()
      .filter((ws) => ws !== server && this.attachment(ws)?.ipKey === ipKey);
    if (fromIp.length >= MAX_SOCKETS_PER_IP) {
      server.close(CLOSE.TOO_MANY, "too many");
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    try {
      const frame = parseFrame<LobbyFrame>(
        lobbyFrameSchema,
        raw,
        MAX_FRAME_CHARS,
      );
      const att = this.attachment(ws);
      if (!frame || !att || att.state !== "pending") {
        ws.close(CLOSE.BAD_FRAME, "bad frame");
        return;
      }
      if (frame.v !== PROTOCOL_VERSION) {
        ws.close(CLOSE.VERSION, "version");
        return;
      }
      await this.handleJoin(ws, att.ipKey, att.connectedAt, frame);
    } catch (err) {
      this.report(err, "message");
    }
  }

  async webSocketClose() {
    // Closing the socket already removed the waiter; only the alarm may need
    // to move (or stop) now that the pool shrank.
    try {
      await this.syncAlarm(Date.now());
    } catch (err) {
      this.report(err, "close");
    }
  }

  async webSocketError() {
    await this.webSocketClose();
  }

  async alarm() {
    this.alarmAt = null;
    try {
      const now = Date.now();
      this.closeExpiredPending(now);
      for (const ws of this.ctx.getWebSockets()) {
        const att = this.attachment(ws);
        if (
          att?.state === "waiting" &&
          now - att.waiter.enqueuedAt >= MAX_QUEUE_WAIT_MS
        ) {
          ws.close(CLOSE.QUEUE_TIMEOUT, "queue timeout");
        }
      }
      const queued = this.waiting();
      const pairs = pickFallbackPairs(
        queued.map((q) => q.waiter),
        now,
      );
      for (const [x, y] of pairs) {
        const first = queued.find((q) => q.waiter.sessionId === x.sessionId);
        const second = queued.find((q) => q.waiter.sessionId === y.sessionId);
        if (first && second) await this.createRoom(first, second, false);
      }
      await this.syncAlarm(now);
    } catch (err) {
      this.report(err, "alarm");
      throw err;
    }
  }

  private async handleJoin(
    ws: WebSocket,
    ipKey: string,
    connectedAt: number,
    frame: LobbyFrame,
  ) {
    const identity = normalizeIdentity(frame);
    const joinCode = normalizeCode(frame.joinCode);
    if (!identity || joinCode === undefined) {
      ws.close(CLOSE.BAD_FRAME, "bad frame");
      return;
    }
    const [secretHash, inviteCode] = await Promise.all([
      hashSecret(frame.secret),
      inviteCodeFor(frame.secret),
    ]);
    // Everything from here to the claim is synchronous, so the pool can't
    // change underneath the decision.
    for (const other of this.waiting()) {
      if (other.waiter.sessionId !== frame.sessionId) continue;
      if (!hashesEqual(other.waiter.secretHash, secretHash)) {
        // Someone else's session id: refuse rather than kick the real owner.
        ws.close(CLOSE.UNAUTHORIZED, "unauthorized");
        return;
      }
      other.ws.close(CLOSE.SUPERSEDED, "superseded");
    }

    const now = Date.now();
    const joiner: Joiner = {
      sessionId: frame.sessionId,
      secretHash,
      interests: identity.interests,
      joinCode,
    };
    const seat: RoomSeat = {
      ...identity,
      sessionId: frame.sessionId,
      secretHash,
    };
    const self = { ws, waiter: newWaiter(joiner, inviteCode, now), seat };
    const others = this.waiting().filter((q) => q.ws !== ws);
    const pick = pickPartner(
      others.map((q) => q.waiter),
      joiner,
    );
    const partner = pick
      ? others.find((q) => q.waiter.sessionId === pick.partner.sessionId)
      : undefined;

    if (pick && partner) {
      await this.createRoom(self, partner, pick.viaInvite, {
        ipKey,
        connectedAt,
      });
      // A failed creation requeues both, and they need the fallback alarm.
      await this.syncAlarm(Date.now());
      return;
    }
    ws.serializeAttachment({
      state: "waiting",
      ipKey,
      connectedAt,
      ...self,
    } satisfies LobbyAttachment);
    this.sendTo(ws, { t: "waiting", since: now });
    await this.syncAlarm(now);
  }

  /** Claims both sockets, creates the room, then hands out the matchId. A
   *  socket that closes mid-creation aborts the room and requeues the other. */
  private async createRoom(
    first: QueuedSeat & { ws: WebSocket },
    second: QueuedSeat & { ws: WebSocket },
    viaInvite: boolean,
    firstMeta?: { ipKey: string; connectedAt: number },
  ) {
    const metaOf = (q: QueuedSeat & { ws: WebSocket }) => {
      const att = this.attachment(q.ws);
      return firstMeta && q === first
        ? firstMeta
        : {
            ipKey: att?.ipKey ?? "unknown",
            connectedAt: att?.connectedAt ?? 0,
          };
    };
    const setState = (
      q: QueuedSeat & { ws: WebSocket },
      state: "waiting" | "pairing",
    ) => {
      if (q.ws.readyState !== WebSocket.OPEN) return;
      q.ws.serializeAttachment({
        state,
        ...metaOf(q),
        waiter: q.waiter,
        seat: q.seat,
      } satisfies LobbyAttachment);
    };
    setState(first, "pairing");
    setState(second, "pairing");

    const matchId = crypto.randomUUID();
    const room = this.env.CHAT_ROOM.get(
      this.env.CHAT_ROOM.idFromName(matchId),
      {
        locationHint: CHAT_LOCATION_HINT,
      },
    );
    try {
      await room.init({ matchId, a: first.seat, b: second.seat });
    } catch (err) {
      this.report(err, "room-init");
      setState(first, "waiting");
      setState(second, "waiting");
      return;
    }
    const bothOpen =
      first.ws.readyState === WebSocket.OPEN &&
      second.ws.readyState === WebSocket.OPEN;
    if (!bothOpen) {
      await room.abort();
      setState(first, "waiting");
      setState(second, "waiting");
      return;
    }
    for (const q of [first, second]) {
      this.sendTo(q.ws, { t: "matched", matchId, viaInvite });
      q.ws.close(CLOSE.NORMAL, "matched");
    }
  }

  private waiting(): (QueuedSeat & { ws: WebSocket })[] {
    const out: (QueuedSeat & { ws: WebSocket })[] = [];
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const att = this.attachment(ws);
      if (att?.state === "waiting") {
        out.push({ ws, waiter: att.waiter, seat: att.seat });
      }
    }
    return out;
  }

  private closeExpiredPending(now: number) {
    for (const ws of this.ctx.getWebSockets()) {
      const att = this.attachment(ws);
      if (
        att?.state === "pending" &&
        now - att.connectedAt > AUTH_DEADLINE_MS
      ) {
        ws.close(CLOSE.UNAUTHORIZED, "join timeout");
      }
    }
  }

  /** Wakes for the next fallback pairing or queue timeout, whichever is first.
   *  No waiters means no alarm. */
  private async syncAlarm(now: number) {
    const pool = this.waiting().map((q) => q.waiter);
    const fallback = nextFallbackAt(pool);
    const timeouts = pool.map((w) => w.enqueuedAt + MAX_QUEUE_WAIT_MS);
    const candidates = [fallback, ...timeouts].filter(
      (t): t is number => t !== null,
    );
    // The floor keeps a pair that keeps failing to get a room from spinning
    // the alarm in a tight loop.
    const next =
      candidates.length > 0
        ? Math.max(now + SECOND, Math.min(...candidates))
        : null;
    if (this.alarmAt === undefined) {
      this.alarmAt = await this.ctx.storage.getAlarm();
    }
    if (next === this.alarmAt) return;
    if (next === null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(next);
    this.alarmAt = next;
  }

  private attachment(ws: WebSocket): LobbyAttachment | null {
    return ws.deserializeAttachment() as LobbyAttachment | null;
  }

  private sendTo(ws: WebSocket, frame: LobbyServerFrame) {
    try {
      ws.send(JSON.stringify(frame));
    } catch {
      // Closed between the check and the send.
    }
  }

  private report(err: unknown, where: string) {
    captureServerException(this.env, (p) => this.ctx.waitUntil(p), err, {
      properties: { where: `chat-lobby:${where}` },
    });
  }
}
