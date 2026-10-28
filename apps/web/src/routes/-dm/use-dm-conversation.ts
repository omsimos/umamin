import { useCallback, useEffect, useReducer, useRef } from "react";
import { PING_INTERVAL_MS, PONG_TIMEOUT_MS } from "@/lib/chat/constants";
import {
  type DmState,
  dmReducer,
  initialDmState,
  lastPeerSeq,
} from "@/lib/dm/client-state";
import {
  CLOSE,
  DM_CLOSED,
  DM_PROTOCOL_VERSION,
  type DmErrorCode,
  type DmFrame,
  type DmServerFrame,
  PING,
  PONG,
} from "@/lib/dm/protocol";
import type { DmReplyPreview, DmReportReason } from "@/lib/dm/types";
import {
  createReconnectingSocket,
  type ReconnectingSocket,
} from "@/lib/realtime/socket";

/** A peer's typing indicator clears after this long without a refresh. */
const TYPING_STALE_MS = 8_000;
/** Codes after which reconnecting can't help. */
const FINAL_CODES = new Set<number>([
  DM_CLOSED,
  CLOSE.GONE,
  CLOSE.UNAUTHORIZED,
  CLOSE.BAD_FRAME,
  CLOSE.VERSION,
]);
const RELOAD_KEY = "umamin-dm:versionReloadAt";

type OpResult = { ok: true } | { ok: false; code: DmErrorCode | "offline" };

function wsUrl(username: string): string {
  const url = new URL(
    `/api/dm/socket/${encodeURIComponent(username)}`,
    globalThis.location.origin,
  );
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

/** An old bundle against a new protocol: reload once, not in a loop. */
function reloadForVersion() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Storage blocked: reloading once more is still the right call.
  }
  globalThis.location.reload();
}

export interface DmConversation {
  state: DmState;
  peerTyping: boolean;
  send: (text: string, replyTo: DmReplyPreview | null) => void;
  retry: (clientId: string) => void;
  react: (messageId: string, emoji: string) => Promise<OpResult>;
  unsend: (messageId: string) => Promise<OpResult>;
  report: (messageId: string, reason: DmReportReason) => Promise<OpResult>;
  setTyping: (on: boolean) => void;
  loadOlder: () => void;
}

/**
 * One conversation's socket. It is open only while the page is visible, so a
 * backgrounded tab reads as offline and the peer's messages arrive as pushes.
 */
export function useDmConversation(
  username: string,
  onError?: (code: DmErrorCode) => void,
): DmConversation {
  const [state, dispatch] = useReducer(dmReducer, initialDmState);
  const socketRef = useRef<ReconnectingSocket | null>(null);
  // Sends not yet acked, replayed after a reconnect. The server dedupes on
  // the op id, so a replay can't double-post.
  const pendingSends = useRef(new Map<string, DmFrame>());
  const waiters = useRef(new Map<string, (r: OpResult) => void>());
  const readSent = useRef(0);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  });

  const sendFrame = useCallback((frame: DmFrame) => {
    return socketRef.current?.send(JSON.stringify(frame)) ?? false;
  }, []);

  useEffect(() => {
    let tooMany = 0;
    const settle = (id: string, result: OpResult) => {
      waiters.current.get(id)?.(result);
      waiters.current.delete(id);
    };

    const handle = (raw: string) => {
      let frame: DmServerFrame;
      try {
        frame = JSON.parse(raw) as DmServerFrame;
      } catch {
        return;
      }
      switch (frame.t) {
        case "sync":
          tooMany = 0;
          dispatch({
            type: "sync",
            messages: frame.messages,
            meta: frame.meta,
            hasMore: frame.hasMore,
          });
          for (const pending of pendingSends.current.values()) {
            socketRef.current?.send(JSON.stringify(pending));
          }
          return;
        case "msgs":
          dispatch({ type: "msgs", messages: frame.messages });
          return;
        case "history":
          dispatch({
            type: "history",
            messages: frame.messages,
            hasMore: frame.hasMore,
          });
          return;
        case "meta":
          dispatch({ type: "meta", meta: frame.meta });
          return;
        case "typing":
          dispatch({ type: "typing", on: frame.on, at: Date.now() });
          return;
        case "ack":
          pendingSends.current.delete(frame.id);
          settle(frame.id, { ok: true });
          return;
        case "err":
          if (!frame.id) return;
          if (pendingSends.current.delete(frame.id)) {
            dispatch({ type: "failed", clientId: frame.id });
            onErrorRef.current?.(frame.code);
          }
          settle(frame.id, { ok: false, code: frame.code });
      }
    };

    const open = () => {
      if (socketRef.current) return;
      readSent.current = 0;
      socketRef.current = createReconnectingSocket({
        url: () => wsUrl(username),
        keepalive: {
          ping: PING,
          pong: PONG,
          intervalMs: PING_INTERVAL_MS,
          timeoutMs: PONG_TIMEOUT_MS,
        },
        // Visibility is handled below: a hidden page closes the socket.
        doc: null,
        isPermanentClose: (code) => FINAL_CODES.has(code),
        onOpen: (send) => {
          send(JSON.stringify({ t: "hi", v: DM_PROTOCOL_VERSION }));
        },
        onMessage: handle,
        onClose: (code, willReconnect) => {
          for (const id of waiters.current.keys()) {
            settle(id, { ok: false, code: "offline" });
          }
          if (code === CLOSE.TOO_MANY && ++tooMany >= 5) {
            socketRef.current?.close();
            socketRef.current = null;
            dispatch({ type: "status", status: "busy" });
            return;
          }
          if (code === CLOSE.VERSION) {
            reloadForVersion();
            return;
          }
          if (!willReconnect) {
            socketRef.current = null;
            dispatch({ type: "status", status: "unavailable" });
            return;
          }
          dispatch({ type: "status", status: "reconnecting" });
        },
      });
    };

    const close = () => {
      socketRef.current?.close();
      socketRef.current = null;
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        dispatch({ type: "status", status: "connecting" });
        open();
      } else {
        close();
      }
    };

    if (document.visibilityState === "visible") open();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      close();
    };
  }, [username]);

  // A visible screen reads what it shows.
  const peerSeq = lastPeerSeq(state.messages);
  useEffect(() => {
    if (state.status !== "open" || peerSeq <= readSent.current) return;
    if (document.visibilityState !== "visible") return;
    if (sendFrame({ t: "read", upTo: String(peerSeq) })) {
      readSent.current = peerSeq;
    }
  }, [peerSeq, state.status, sendFrame]);

  // The peer's typing flag expires if its "off" never arrives.
  const [, forceTick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (state.peerTypingAt === null) return;
    const t = setTimeout(forceTick, TYPING_STALE_MS);
    return () => clearTimeout(t);
  }, [state.peerTypingAt]);
  const peerTyping =
    state.peerTypingAt !== null &&
    Date.now() - state.peerTypingAt < TYPING_STALE_MS;

  const send = useCallback(
    (text: string, replyTo: DmReplyPreview | null) => {
      const clientId = crypto.randomUUID();
      const frame: DmFrame = {
        t: "send",
        id: clientId,
        text,
        ...(replyTo ? { replyTo: replyTo.id } : {}),
      };
      pendingSends.current.set(clientId, frame);
      dispatch({ type: "send", clientId, text, replyTo, at: Date.now() });
      // Offline: it stays "sending" and goes out with the next sync.
      sendFrame(frame);
    },
    [sendFrame],
  );

  const retry = useCallback(
    (clientId: string) => {
      const frame = pendingSends.current.get(clientId);
      if (!frame) return;
      dispatch({ type: "retry", clientId });
      sendFrame(frame);
    },
    [sendFrame],
  );

  const request = useCallback(
    (frame: DmFrame & { id: string }): Promise<OpResult> => {
      if (!sendFrame(frame)) {
        return Promise.resolve({ ok: false, code: "offline" });
      }
      return new Promise((resolve) => waiters.current.set(frame.id, resolve));
    },
    [sendFrame],
  );

  return {
    state,
    peerTyping,
    send,
    retry,
    react: (messageId, emoji) =>
      request({ t: "react", id: crypto.randomUUID(), messageId, emoji }),
    unsend: (messageId) =>
      request({ t: "unsend", id: crypto.randomUUID(), messageId }),
    report: (messageId, reason) =>
      request({ t: "report", id: crypto.randomUUID(), messageId, reason }),
    setTyping: (on) => {
      sendFrame({ t: "typing", on });
    },
    loadOlder: () => {
      const oldest = state.messages.find((m) => !m.id.startsWith("local:"));
      if (!oldest || state.loadingOlder || !state.hasMore) return;
      dispatch({ type: "loadOlder" });
      sendFrame({ t: "history", id: crypto.randomUUID(), before: oldest.id });
    },
  };
}
