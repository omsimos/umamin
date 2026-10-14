/**
 * A reconnecting WebSocket with an application-level keepalive. Generic on
 * purpose: it knows nothing about the frames it carries, so group chat can
 * adopt it later. The owner re-sends whatever handshake it needs from
 * `onOpen`, which runs on every (re)connect.
 *
 * SSR-safe: nothing touches `window`, `document` or `WebSocket` until
 * `createReconnectingSocket` is called.
 */

/** The slice of the browser WebSocket this module uses, so tests can inject a
 *  hand-written fake. */
export interface WebSocketLike {
  readonly readyState: number;
  onopen: ((ev: Event) => unknown) | null;
  onmessage: ((ev: MessageEvent) => unknown) | null;
  onclose: ((ev: CloseEvent) => unknown) | null;
  onerror: ((ev: Event) => unknown) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export type WebSocketCtor = new (url: string) => WebSocketLike;

type Listenable = Pick<EventTarget, "addEventListener" | "removeEventListener">;

export interface ReconnectingSocketOptions {
  /** Resolved on every connect attempt. */
  url: string | (() => string);
  /** Runs on every successful (re)connect, before any message. */
  onOpen: (send: (data: string) => boolean) => void;
  /** Text frames only; keepalive replies are consumed here. */
  onMessage: (data: string) => void;
  /** Runs when a connection is lost, but never after `close()`. */
  onClose?: (code: number, willReconnect: boolean) => void;
  /** Close codes that stop reconnecting. */
  isPermanentClose?: (code: number) => boolean;
  keepalive?: {
    ping: string;
    pong: string;
    intervalMs: number;
    timeoutMs: number;
  };
  backoff?: { baseMs?: number; maxMs?: number; stableMs?: number };
  WebSocketImpl?: WebSocketCtor;
  random?: () => number;
  /** Sources of the reconnect triggers. Default to the global window and
   *  document; pass null to disable. */
  win?: Listenable | null;
  doc?: (Listenable & { readonly visibilityState: string }) | null;
}

export interface ReconnectingSocket {
  /** Returns false (and drops the data) when the socket is not open. */
  send(data: string): boolean;
  isOpen(): boolean;
  /** Skips any pending backoff, or probes an open socket for liveness. */
  reconnectNow(): void;
  /** Closes for good: no more reconnects, callbacks, listeners or timers. */
  close(code?: number): void;
}

const OPEN = 1;
const CLOSING = 2;
/** Reported to `onClose` when the client gave up on a dead connection. */
export const ABNORMAL_CLOSE = 1006;

const DEFAULT_KEEPALIVE = {
  ping: "ping",
  pong: "pong",
  intervalMs: 25_000,
  timeoutMs: 10_000,
};

export function createReconnectingSocket(
  options: ReconnectingSocketOptions,
): ReconnectingSocket {
  const keepalive = options.keepalive ?? DEFAULT_KEEPALIVE;
  const baseMs = options.backoff?.baseMs ?? 250;
  const maxMs = options.backoff?.maxMs ?? 5_000;
  const stableMs = options.backoff?.stableMs ?? 5_000;
  const random = options.random ?? Math.random;
  const Impl =
    options.WebSocketImpl ??
    (globalThis as { WebSocket?: WebSocketCtor }).WebSocket;
  const win =
    options.win === undefined
      ? typeof window === "undefined"
        ? null
        : window
      : options.win;
  const doc =
    options.doc === undefined
      ? typeof document === "undefined"
        ? null
        : document
      : options.doc;

  let ws: WebSocketLike | null = null;
  let closed = false;
  let attempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let pongTimer: ReturnType<typeof setTimeout> | null = null;
  let stableTimer: ReturnType<typeof setTimeout> | null = null;

  function clearConnectionTimers() {
    if (pingTimer !== null) clearInterval(pingTimer);
    if (pongTimer !== null) clearTimeout(pongTimer);
    if (stableTimer !== null) clearTimeout(stableTimer);
    pingTimer = pongTimer = stableTimer = null;
  }

  function detach(socket: WebSocketLike) {
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.onerror = null;
  }

  function send(data: string): boolean {
    if (!ws || ws.readyState !== OPEN) return false;
    try {
      ws.send(data);
      return true;
    } catch {
      return false;
    }
  }

  function probe() {
    if (pongTimer !== null || !send(keepalive.ping)) return;
    pongTimer = setTimeout(() => {
      pongTimer = null;
      if (ws) lost(ws, ABNORMAL_CLOSE);
    }, keepalive.timeoutMs);
  }

  function scheduleReconnect() {
    if (closed || reconnectTimer !== null) return;
    // Full jitter: spreads a deploy's mass reconnect instead of stampeding.
    const delay = random() * Math.min(maxMs, baseMs * 2 ** attempt);
    attempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  /** The connection is gone, whether the server closed it or we gave up. */
  function lost(socket: WebSocketLike, code: number) {
    if (socket !== ws) return;
    detach(socket);
    ws = null;
    clearConnectionTimers();
    if (socket.readyState < CLOSING) {
      try {
        socket.close();
      } catch {
        // Already failing.
      }
    }
    const permanent = options.isPermanentClose?.(code) ?? false;
    options.onClose?.(code, !permanent && !closed);
    if (permanent) {
      close();
      return;
    }
    scheduleReconnect();
  }

  function connect() {
    if (closed || ws) return;
    if (!Impl) return;
    let socket: WebSocketLike;
    try {
      const url =
        typeof options.url === "function" ? options.url() : options.url;
      socket = new Impl(url);
    } catch {
      scheduleReconnect();
      return;
    }
    ws = socket;
    socket.onopen = () => {
      if (socket !== ws) return;
      // Only a connection that stays up resets the backoff, so a server that
      // accepts and immediately closes still backs off.
      stableTimer = setTimeout(() => {
        stableTimer = null;
        attempt = 0;
      }, stableMs);
      pingTimer = setInterval(probe, keepalive.intervalMs);
      options.onOpen(send);
    };
    socket.onmessage = (ev) => {
      if (socket !== ws || typeof ev.data !== "string") return;
      if (ev.data === keepalive.pong) {
        if (pongTimer !== null) clearTimeout(pongTimer);
        pongTimer = null;
        return;
      }
      options.onMessage(ev.data);
    };
    // An error is always followed by a close event, which does the work.
    socket.onclose = (ev) => lost(socket, ev.code);
  }

  function reconnectNow() {
    if (closed) return;
    if (ws === null) {
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      connect();
    } else if (ws.readyState === OPEN) {
      // A backgrounded tab's socket may be half-open: ask for a pong now
      // instead of waiting for the next interval.
      probe();
    } else if (ws.readyState >= CLOSING) {
      lost(ws, ABNORMAL_CLOSE);
    }
  }

  function onVisibility() {
    if (doc?.visibilityState === "visible") reconnectNow();
  }

  function close(code = 1000) {
    if (closed) return;
    closed = true;
    if (reconnectTimer !== null) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    clearConnectionTimers();
    win?.removeEventListener("online", reconnectNow);
    win?.removeEventListener("pageshow", reconnectNow);
    doc?.removeEventListener("visibilitychange", onVisibility);
    const socket = ws;
    ws = null;
    if (socket) {
      detach(socket);
      if (socket.readyState < CLOSING) {
        try {
          socket.close(code);
        } catch {
          // Already closing.
        }
      }
    }
  }

  win?.addEventListener("online", reconnectNow);
  win?.addEventListener("pageshow", reconnectNow);
  doc?.addEventListener("visibilitychange", onVisibility);
  connect();

  return {
    send,
    isOpen: () => ws?.readyState === OPEN,
    reconnectNow,
    close,
  };
}
