/**
 * The browser side of Umamin Chat: implements ChatTransport over two sockets,
 * the lobby (`/api/chat/lobby`, while matching) and one room per match
 * (`/api/chat/room/<matchId>`). Both are Durable Objects; see
 * server-lib/chat and the wire protocol in lib/chat/protocol.ts.
 *
 * The snapshot object only changes when a frame or a local action changes
 * state, because the UI reads it with useSyncExternalStore.
 */
import {
  PING_INTERVAL_MS,
  PONG_TIMEOUT_MS,
  REPLY_PREVIEW_LEN,
  SECOND,
} from "@/lib/chat/constants";
import {
  CLOSE,
  type LobbyFrame,
  type LobbyServerFrame,
  PING,
  PONG,
  PROTOCOL_VERSION,
  type RoomFrame,
  type RoomOpFrame,
  type RoomServerFrame,
  type ServerErrorCode,
} from "@/lib/chat/protocol";
import {
  type ChatMessage,
  type ChatTransport,
  type FindMatchOptions,
  type GameMode,
  type GamePick,
  IDLE_SNAPSHOT,
  LOADING_SNAPSHOT,
  type SelfIdentity,
  type SendOpts,
  type SessionSnapshot,
  type SnapshotMeta,
} from "@/lib/chat/types";
import {
  createReconnectingSocket,
  type ReconnectingSocket,
  type WebSocketCtor,
} from "@/lib/realtime/socket";
import { type SessionCredentials, uuid } from "../session/session-id";

export const MATCH_ID_KEY = "umamin-chat:matchId";
const RELOAD_KEY = "umamin-chat:versionReloadAt";

export const RATE_LIMITED_MESSAGE =
  "You're going a little fast. Try again in a moment.";
const GENERIC_ERROR = "Something went wrong. Please try again.";
const ERROR_MESSAGES: Record<
  Exclude<ServerErrorCode, "rate_limited">,
  string
> = {
  invalid: GENERIC_ERROR,
  locked: "That unlocks at a higher vibe level. Keep the chat flowing.",
  not_unlocked: "You both need to tap the heart first.",
  cap: "This chat has hit its message limit.",
};
export const QUEUE_TIMEOUT_MESSAGE =
  "No one turned up this time. Try searching again.";
const UNREACHABLE_MESSAGE =
  "Couldn't reach Umamin Chat. Check your connection and try again.";
const OFFLINE_MESSAGE = "Reconnecting. Try that again in a moment.";
const UPDATED_MESSAGE = "Umamin Chat was updated. Refresh the page.";

/** A partner's typing indicator clears after this long without a refresh. */
export const TYPING_STALE_MS = 8 * SECOND;
/** While typing continues, `on` is re-sent at most this often. */
export const TYPING_REFRESH_MS = 5 * SECOND;
/** How long leave() waits for the room's ack before closing anyway. */
export const LEAVE_ACK_TIMEOUT_MS = 1 * SECOND;
/** Sends queued while disconnected; beyond this they fail immediately. */
export const MAX_QUEUED_SENDS = 20;
/** Connect attempts that never open before the lobby or a reload resume
 *  gives up. A rejected upgrade (flag off, rate limited) looks exactly like a
 *  network failure to the browser, so without a bound it would retry forever. */
export const MAX_FAILED_CONNECTS = 8;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEQ_RE = /^\d{1,9}$/;

/** These codes are final; anything else is retried with backoff. */
const FINAL_CODES: ReadonlySet<number> = new Set([
  CLOSE.UNAUTHORIZED,
  CLOSE.GONE,
  CLOSE.QUEUE_TIMEOUT,
  CLOSE.SUPERSEDED,
  CLOSE.VERSION,
]);

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface WsTransportOptions {
  credentials: SessionCredentials;
  onRateLimited: (message: string) => void;
  onError: (message: string) => void;
  /** Defaults to `location.origin`. */
  baseUrl?: string;
  WebSocketImpl?: WebSocketCtor;
  /** Holds the resumable matchId. Defaults to localStorage. */
  storage?: StorageLike;
  /** Called on a protocol-version close. Defaults to a guarded
   *  `location.reload()`; returning false means it declined. */
  reload?: () => boolean | undefined;
  random?: () => number;
}

interface PendingSend {
  tempId: string;
  /** Fixed for the life of the bubble: the room dedupes sends by op id, so a
   *  retry or a post-reconnect flush can never store the message twice. */
  opId: string;
  text: string;
  opts: SendOpts;
  message: ChatMessage;
  /** queued: waiting for a synced socket. sending: on the wire. acked: stored
   *  as `messageId`, whose row hasn't arrived yet. */
  status: "queued" | "sending" | "acked" | "failed";
  messageId?: string;
}

type Mode =
  | { kind: "idle" }
  | {
      kind: "lobby";
      self: SelfIdentity;
      socket: ReconnectingSocket;
    }
  | {
      kind: "room";
      matchId: string;
      /** Identity from findMatch; null on a reload resume. */
      self: SelfIdentity | null;
      socket: ReconnectingSocket;
    }
  /** The room is gone (purged or dropped after the end) but the ended view
   *  stays up until the user leaves. */
  | { kind: "held" };

interface Leaving {
  opId: string | null;
  timer: ReturnType<typeof setTimeout>;
}

let reloadedThisPage = false;

/** Reloads at most once per page load, and not again within a minute across
 *  loads, so a client newer than the server can't loop. */
function guardedReload(): boolean {
  if (reloadedThisPage) return false;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < 60 * SECOND) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // No sessionStorage: the per-page flag still applies.
  }
  reloadedThisPage = true;
  location.reload();
  return true;
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function createWsTransport(
  options: WsTransportOptions,
): ChatTransport & { dispose(): void } {
  const { credentials, onRateLimited, onError } = options;
  const storage = options.storage ?? defaultStorage();
  const reload = options.reload ?? guardedReload;

  const listeners = new Set<(snapshot: SessionSnapshot) => void>();
  let mode: Mode = { kind: "idle" };
  let disposed = false;

  // Room state. Reset whenever the room changes.
  let meta: SnapshotMeta | null = null;
  const serverMessages = new Map<string, ChatMessage>();
  let serverList: ChatMessage[] = [];
  let pending: PendingSend[] = [];
  let synced = false;
  let failedConnects = 0;
  let partnerTyping = false;
  let partnerTypingTimer: ReturnType<typeof setTimeout> | null = null;
  let selfTyping = false;
  let selfTypingSentAt = 0;
  let tempSeq = 0;
  let leaving: Leaving | null = null;
  let pendingFind: { self: SelfIdentity; options?: FindMatchOptions } | null =
    null;
  let reloadRequested = false;

  // --- Snapshot ------------------------------------------------------------

  let snapshot: SessionSnapshot = IDLE_SNAPSHOT;
  let matchingCache: SessionSnapshot | null = null;
  let roomCache: {
    meta: SnapshotMeta;
    list: ChatMessage[];
    temps: ChatMessage[];
    typing: boolean;
    snap: SessionSnapshot;
  } | null = null;

  function matchingSnapshot(self: SelfIdentity): SessionSnapshot {
    if (matchingCache?.self !== self) {
      matchingCache = { ...IDLE_SNAPSHOT, phase: "matching", self };
    }
    return matchingCache;
  }

  function roomSnapshot(m: SnapshotMeta): SessionSnapshot {
    const temps = pending.map((p) => p.message);
    if (
      roomCache &&
      roomCache.meta === m &&
      roomCache.list === serverList &&
      roomCache.typing === partnerTyping &&
      roomCache.temps.length === temps.length &&
      roomCache.temps.every((t, i) => t === temps[i])
    ) {
      return roomCache.snap;
    }
    const partner =
      m.partner && partnerTyping && m.partner.status === "online"
        ? { ...m.partner, status: "typing" as const }
        : m.partner;
    const snap: SessionSnapshot = {
      ...m,
      partner,
      messages: temps.length > 0 ? [...serverList, ...temps] : serverList,
    };
    roomCache = {
      meta: m,
      list: serverList,
      temps,
      typing: partnerTyping,
      snap,
    };
    return snap;
  }

  function build(): SessionSnapshot {
    if (leaving) {
      // Rematch: show the radar at once, never the chat being left. A plain
      // leave holds the current view until it settles to idle.
      return pendingFind ? matchingSnapshot(pendingFind.self) : snapshot;
    }
    switch (mode.kind) {
      case "idle":
        return IDLE_SNAPSHOT;
      case "lobby":
        return matchingSnapshot(mode.self);
      case "room":
        if (meta) return roomSnapshot(meta);
        return mode.self ? matchingSnapshot(mode.self) : LOADING_SNAPSHOT;
      case "held":
        return meta ? roomSnapshot(meta) : IDLE_SNAPSHOT;
    }
  }

  function commit() {
    if (disposed) return;
    const next = build();
    if (next === snapshot) return;
    snapshot = next;
    for (const listener of listeners) listener(snapshot);
  }

  // --- Helpers -------------------------------------------------------------

  function wsUrl(path: string): string {
    const base = options.baseUrl ?? globalThis.location?.origin ?? "";
    const url = new URL(path, base);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.toString();
  }

  function store(matchId: string | null) {
    try {
      if (matchId) storage?.setItem(MATCH_ID_KEY, matchId);
      else storage?.removeItem(MATCH_ID_KEY);
    } catch {
      // Private mode or quota: resume just won't survive a reload.
    }
  }

  function readStoredMatchId(): string | null {
    try {
      const id = storage?.getItem(MATCH_ID_KEY) ?? null;
      if (id && UUID_RE.test(id)) return id;
      if (id) storage?.removeItem(MATCH_ID_KEY);
    } catch {
      // Unreadable storage: start idle.
    }
    return null;
  }

  function reportError(code: ServerErrorCode) {
    if (code === "rate_limited") onRateLimited(RATE_LIMITED_MESSAGE);
    else onError(ERROR_MESSAGES[code] ?? GENERIC_ERROR);
  }

  // Unique across reloads and tabs, since the room keys send dedupe on it.
  const newOpId = uuid;

  function clearPartnerTyping() {
    if (partnerTypingTimer !== null) clearTimeout(partnerTypingTimer);
    partnerTypingTimer = null;
    partnerTyping = false;
  }

  function updatePending(
    tempId: string,
    fn: (p: PendingSend) => PendingSend | null,
  ) {
    let changed = false;
    const next: PendingSend[] = [];
    for (const p of pending) {
      if (p.tempId !== tempId) {
        next.push(p);
        continue;
      }
      changed = true;
      const updated = fn(p);
      if (updated) next.push(updated);
    }
    if (changed) pending = next;
  }

  function withStatus(
    p: PendingSend,
    status: PendingSend["status"],
  ): PendingSend {
    const delivery =
      status === "failed" ? ("failed" as const) : ("sending" as const);
    return p.message.delivery === delivery && p.status === status
      ? p
      : { ...p, status, message: { ...p.message, delivery } };
  }

  function rebuildServerList() {
    serverList = [...serverMessages.values()].sort(
      (a, b) => Number(a.id) - Number(b.id),
    );
  }

  function resetRoomState() {
    meta = null;
    serverMessages.clear();
    serverList = [];
    pending = [];
    synced = false;
    failedConnects = 0;
    clearPartnerTyping();
    selfTyping = false;
    selfTypingSentAt = 0;
    roomCache = null;
  }

  function roomSocket(): ReconnectingSocket | null {
    return mode.kind === "room" ? mode.socket : null;
  }

  function canSendOps(): boolean {
    return synced && Boolean(roomSocket()?.isOpen());
  }

  // --- Lobby ---------------------------------------------------------------

  function startLobby(self: SelfIdentity, findOptions?: FindMatchOptions) {
    const joinCode = findOptions?.joinCode;
    failedConnects = 0;
    const socket = createReconnectingSocket({
      url: () => wsUrl("/api/chat/lobby"),
      WebSocketImpl: options.WebSocketImpl,
      random: options.random,
      keepalive: {
        ping: PING,
        pong: PONG,
        intervalMs: PING_INTERVAL_MS,
        timeoutMs: PONG_TIMEOUT_MS,
      },
      // A rejected join frame is deterministic; resending it can't succeed.
      isPermanentClose: (code) =>
        FINAL_CODES.has(code) || code === CLOSE.BAD_FRAME,
      onOpen: (send) => {
        failedConnects = 0;
        const frame: LobbyFrame = {
          t: "join",
          v: PROTOCOL_VERSION,
          sessionId: credentials.sessionId,
          secret: credentials.sessionSecret,
          alias: self.alias,
          avatarSeed: self.avatarSeed,
          interests: self.interests,
          ...(joinCode ? { joinCode } : {}),
        };
        send(JSON.stringify(frame));
      },
      onMessage: (data) => {
        if (mode.kind !== "lobby" || mode.socket !== socket) return;
        const frame = parse<LobbyServerFrame>(data);
        if (frame?.t !== "matched") return;
        socket.close();
        if (joinCode && !frame.viaInvite) findOptions?.onInviteMiss?.();
        openRoom(frame.matchId, self);
      },
      onClose: (code, willReconnect) => {
        if (mode.kind !== "lobby" || mode.socket !== socket) return;
        if (willReconnect) {
          failedConnects += 1;
          if (failedConnects < MAX_FAILED_CONNECTS) return;
          socket.close();
          toIdle();
          onError(UNREACHABLE_MESSAGE);
          return;
        }
        if (code === CLOSE.VERSION) {
          versionMismatch();
          return;
        }
        toIdle();
        if (code === CLOSE.QUEUE_TIMEOUT) onError(QUEUE_TIMEOUT_MESSAGE);
        else if (code === CLOSE.BAD_FRAME) onError(GENERIC_ERROR);
      },
    });
    mode = { kind: "lobby", self, socket };
  }

  // --- Room ----------------------------------------------------------------

  function openRoom(matchId: string, self: SelfIdentity | null) {
    resetRoomState();
    store(matchId);
    const socket = createReconnectingSocket({
      url: () => wsUrl(`/api/chat/room/${encodeURIComponent(matchId)}`),
      WebSocketImpl: options.WebSocketImpl,
      random: options.random,
      keepalive: {
        ping: PING,
        pong: PONG,
        intervalMs: PING_INTERVAL_MS,
        timeoutMs: PONG_TIMEOUT_MS,
      },
      // Once the match has ended there is nothing left to resume: hold the
      // ended view instead of reconnecting just to be told 4404.
      isPermanentClose: (code) =>
        FINAL_CODES.has(code) || meta?.phase === "ended",
      onOpen: (send) => {
        failedConnects = 0;
        const frame: RoomFrame = {
          t: "auth",
          v: PROTOCOL_VERSION,
          sessionId: credentials.sessionId,
          secret: credentials.sessionSecret,
        };
        send(JSON.stringify(frame));
      },
      onMessage: (data) => {
        if (mode.kind !== "room" || mode.socket !== socket) return;
        const frame = parse<RoomServerFrame>(data);
        if (frame) onRoomFrame(frame);
      },
      onClose: (code, willReconnect) => {
        if (mode.kind !== "room" || mode.socket !== socket) return;
        onRoomClose(socket, code, willReconnect);
      },
    });
    mode = { kind: "room", matchId, self, socket };
  }

  function onRoomFrame(frame: RoomServerFrame) {
    if (leaving) {
      if (frame.t === "sync") {
        synced = true;
        meta = frame.meta;
        sendLeave();
      } else if (frame.t === "ack" && frame.id === leaving.opId) {
        finishLeave();
      }
      return;
    }
    switch (frame.t) {
      case "sync": {
        synced = true;
        meta = frame.meta;
        serverMessages.clear();
        for (const m of frame.messages) serverMessages.set(m.id, m);
        rebuildServerList();
        // Anything acked is stored, so the sync has it, and so is any
        // re-queued send whose row comes back carrying its op id. The rest
        // go out now in order.
        const stored = new Set(frame.messages.map((m) => m.clientId));
        pending = pending.filter(
          (p) => p.status !== "acked" && !stored.has(p.opId),
        );
        for (const p of pending) {
          if (p.status === "queued") transmit(p.tempId);
        }
        break;
      }
      case "meta":
        if (!meta || !sameJson(meta, frame.meta)) meta = frame.meta;
        break;
      case "msgs":
        upsertMessages(frame.messages);
        break;
      case "typing":
        if (frame.on) {
          if (partnerTypingTimer !== null) clearTimeout(partnerTypingTimer);
          partnerTyping = true;
          partnerTypingTimer = setTimeout(() => {
            partnerTypingTimer = null;
            partnerTyping = false;
            commit();
          }, TYPING_STALE_MS);
        } else {
          clearPartnerTyping();
        }
        break;
      case "ack": {
        const p = pending.find((x) => x.opId === frame.id);
        if (!p) break;
        const { messageId } = frame;
        // No messageId: nothing was stored (an empty or post-end send). A
        // row already in hand (a dedupe hit) replaces the bubble at once;
        // otherwise it waits for the row's upsert.
        if (!messageId || serverMessages.has(messageId)) {
          updatePending(p.tempId, () => null);
        } else {
          updatePending(p.tempId, (q) => ({
            ...withStatus(q, "acked"),
            messageId,
          }));
        }
        break;
      }
      case "err": {
        const p = frame.id
          ? pending.find((x) => x.opId === frame.id)
          : undefined;
        if (p) updatePending(p.tempId, (q) => withStatus(q, "failed"));
        reportError(frame.code);
        break;
      }
    }
    commit();
  }

  function upsertMessages(messages: ChatMessage[]) {
    let changed = false;
    for (const m of messages) {
      const prev = serverMessages.get(m.id);
      if (!prev && m.author === "partner") clearPartnerTyping();
      if (prev && sameJson(prev, m)) continue;
      serverMessages.set(m.id, m);
      changed = true;
    }
    if (changed) rebuildServerList();
    const clientIds = new Set(messages.map((m) => m.clientId));
    const landed = pending.filter(
      (p) =>
        (p.messageId && serverMessages.has(p.messageId)) ||
        clientIds.has(p.opId),
    );
    for (const p of landed) updatePending(p.tempId, () => null);
  }

  function onRoomClose(
    socket: ReconnectingSocket,
    code: number,
    willReconnect: boolean,
  ) {
    synced = false;
    clearPartnerTyping();
    // An acked send is stored and comes back with the next sync. One still
    // in flight is re-queued under its op id: the room dedupes it if it did
    // land, so a deploy's mass disconnect never shows failed bubbles.
    if (pending.some((p) => p.status === "sending" || p.status === "acked")) {
      pending = pending
        .filter((p) => p.status !== "acked")
        .map((p) => (p.status === "sending" ? withStatus(p, "queued") : p));
    }

    if (leaving) {
      finishLeave();
      return;
    }
    if (willReconnect) {
      // A reload resume with no answer at all gives up eventually; a live
      // chat keeps trying, since the room's away grace covers the gap.
      if (!meta) {
        failedConnects += 1;
        if (failedConnects >= MAX_FAILED_CONNECTS) {
          socket.close();
          store(null);
          toIdle();
          return;
        }
      }
      commit();
      return;
    }
    if (code === CLOSE.VERSION) {
      versionMismatch();
      return;
    }
    if (meta?.phase === "ended") {
      // The ended view (and the copyable handle) stays until the user leaves,
      // even though the server has purged the room.
      store(null);
      mode = { kind: "held" };
      // Nothing will reconnect to deliver them.
      for (const p of pending) {
        if (p.status !== "failed") {
          updatePending(p.tempId, (q) => withStatus(q, "failed"));
        }
      }
      commit();
      return;
    }
    store(null);
    toIdle();
  }

  // --- Sending -------------------------------------------------------------

  function transmit(tempId: string) {
    const p = pending.find((x) => x.tempId === tempId);
    if (!p) return;
    const socket = roomSocket();
    if (!canSendOps() || !socket) {
      updatePending(tempId, (q) => withStatus(q, "queued"));
      return;
    }
    const replyTo =
      p.opts.replyToId && SEQ_RE.test(p.opts.replyToId)
        ? p.opts.replyToId
        : undefined;
    const frame: RoomFrame = {
      t: "send",
      id: p.opId,
      text: p.text,
      ...(replyTo ? { replyTo } : {}),
      ...(p.opts.whisper ? { whisper: true } : {}),
      ...(p.opts.effect ? { effect: p.opts.effect } : {}),
    };
    if (socket.send(JSON.stringify(frame))) {
      updatePending(tempId, (q) => withStatus(q, "sending"));
    } else {
      updatePending(tempId, (q) => withStatus(q, "queued"));
    }
  }

  /** Fire-and-forget ops. Unlike sends they aren't queued: a stale tap
   *  replayed after a reconnect could act on a changed conversation. */
  function op(build: (id: string) => RoomOpFrame) {
    if (leaving || mode.kind !== "room") return;
    const socket = roomSocket();
    const id = newOpId();
    if (!socket || !canSendOps() || !socket.send(JSON.stringify(build(id)))) {
      onError(OFFLINE_MESSAGE);
    }
  }

  // --- Leaving -------------------------------------------------------------

  function sendLeave() {
    if (!leaving || leaving.opId !== null) return;
    // An ended match needs no leave op: the room would treat it as a no-op.
    if (meta?.phase !== "active" || !canSendOps()) {
      if (synced || meta?.phase === "ended") finishLeave();
      return;
    }
    const id = newOpId();
    const sent = roomSocket()?.send(
      JSON.stringify({ t: "leave", id } satisfies RoomFrame),
    );
    if (!sent) {
      finishLeave();
      return;
    }
    leaving.opId = id;
  }

  function finishLeave() {
    if (!leaving) return;
    clearTimeout(leaving.timer);
    leaving = null;
    if (mode.kind === "room") mode.socket.close();
    store(null);
    resetRoomState();
    mode = { kind: "idle" };
    const find = pendingFind;
    pendingFind = null;
    if (find) startLobby(find.self, find.options);
    commit();
  }

  function toIdle() {
    if (mode.kind === "lobby" || mode.kind === "room") mode.socket.close();
    resetRoomState();
    mode = { kind: "idle" };
    pendingFind = null;
    commit();
  }

  function versionMismatch() {
    store(null);
    toIdle();
    if (reloadRequested) return;
    reloadRequested = true;
    if (reload() === false) onError(UPDATED_MESSAGE);
  }

  function beginLeave() {
    const timer = setTimeout(finishLeave, LEAVE_ACK_TIMEOUT_MS);
    leaving = { opId: null, timer };
    pending = [];
    // Not synced yet (fresh match or reload): the leave goes out on sync, or
    // the timeout closes anyway.
    if (synced || meta?.phase === "ended") sendLeave();
    commit();
  }

  // --- Boot ----------------------------------------------------------------

  const resumeId = readStoredMatchId();
  if (resumeId) {
    openRoom(resumeId, null);
    snapshot = LOADING_SNAPSHOT;
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getSnapshot() {
      return snapshot;
    },

    findMatch(self: SelfIdentity, findOptions?: FindMatchOptions) {
      if (disposed) return;
      if (leaving) {
        pendingFind = { self, options: findOptions };
        commit();
        return;
      }
      if (mode.kind === "room") {
        // Leave the current room first (a no-op wait once it has ended),
        // then search; the radar shows from this call on.
        pendingFind = { self, options: findOptions };
        beginLeave();
        return;
      }
      if (mode.kind === "lobby") mode.socket.close();
      resetRoomState();
      startLobby(self, findOptions);
      commit();
    },

    send(text: string, opts: SendOpts = {}) {
      const trimmed = text.trim();
      if (!trimmed || leaving || mode.kind !== "room") return;
      if (meta && meta.phase !== "active") return;
      tempSeq += 1;
      const tempId = `tmp-${tempSeq}`;
      const target = opts.replyToId
        ? serverMessages.get(opts.replyToId)
        : undefined;
      const whisper = Boolean(opts.whisper);
      const message: ChatMessage = {
        id: tempId,
        author: "self",
        text: trimmed,
        ts: Date.now(),
        reactions: [],
        delivery: "sending",
        ...(target
          ? {
              replyTo: {
                id: target.id,
                author: target.author,
                text: target.whisper
                  ? "🔥 Whisper"
                  : target.text.slice(0, REPLY_PREVIEW_LEN),
              },
            }
          : {}),
        ...(whisper ? { whisper: { state: "hidden" as const } } : {}),
        ...(opts.effect && !whisper ? { effect: opts.effect } : {}),
      };
      const queued = pending.filter((p) => p.status === "queued").length;
      const entry: PendingSend = {
        tempId,
        opId: newOpId(),
        text: trimmed,
        opts,
        message,
        status: "queued",
      };
      pending = [...pending, entry];
      // The partner clears our indicator when the message lands.
      selfTyping = false;
      if (canSendOps()) transmit(tempId);
      else if (queued >= MAX_QUEUED_SENDS) {
        updatePending(tempId, (p) => withStatus(p, "failed"));
      }
      commit();
    },

    retrySend(messageId: string) {
      const p = pending.find((x) => x.tempId === messageId);
      if (p?.status !== "failed" || leaving) return;
      transmit(messageId);
      commit();
    },

    react(messageId: string, emoji: string) {
      if (!SEQ_RE.test(messageId)) return;
      op((id) => ({ t: "react", id, messageId, emoji }));
    },

    viewWhisper(messageId: string) {
      if (!SEQ_RE.test(messageId)) return;
      op((id) => ({ t: "viewWhisper", id, messageId }));
    },

    dealCard(cardId: string, gameMode?: GameMode) {
      op((id) => ({
        t: "dealCard",
        id,
        cardId,
        ...(gameMode ? { mode: gameMode } : {}),
      }));
    },

    answerCard(cardId: string, pick: GamePick) {
      op((id) => ({ t: "answerCard", id, cardId, pick }));
    },

    dismissGame() {
      op((id) => ({ t: "dismissGame", id }));
    },

    setTyping(isTyping: boolean) {
      // Best effort: never queued while disconnected, never surfaced.
      if (leaving || meta?.phase !== "active") return;
      const socket = roomSocket();
      if (!socket || !canSendOps()) return;
      const now = Date.now();
      if (isTyping) {
        if (selfTyping && now - selfTypingSentAt < TYPING_REFRESH_MS) return;
        const frame: RoomFrame = { t: "typing", on: true };
        if (socket.send(JSON.stringify(frame))) {
          selfTyping = true;
          selfTypingSentAt = now;
        }
        return;
      }
      if (!selfTyping) return;
      selfTyping = false;
      const frame: RoomFrame = { t: "typing", on: false };
      socket.send(JSON.stringify(frame));
    },

    signalStayConnected() {
      op((id) => ({ t: "stayConnected", id }));
    },

    submitRevealHandle(handle: string) {
      op((id) => ({ t: "submitReveal", id, handle }));
    },

    withdrawRevealHandle() {
      op((id) => ({ t: "withdrawReveal", id }));
    },

    leave() {
      pendingFind = null;
      if (leaving) {
        // A cancelled rematch: settle to idle once the old room is left.
        commit();
        return;
      }
      if (mode.kind === "room") {
        beginLeave();
        return;
      }
      store(null);
      toIdle();
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      if (leaving) clearTimeout(leaving.timer);
      leaving = null;
      pendingFind = null;
      if (mode.kind === "lobby" || mode.kind === "room") mode.socket.close();
      clearPartnerTyping();
      mode = { kind: "idle" };
      listeners.clear();
    },
  };
}

function parse<T extends { t: string }>(data: string): T | null {
  try {
    const value = JSON.parse(data) as unknown;
    return value &&
      typeof value === "object" &&
      typeof (value as { t?: unknown }).t === "string"
      ? (value as T)
      : null;
  } catch {
    return null;
  }
}
