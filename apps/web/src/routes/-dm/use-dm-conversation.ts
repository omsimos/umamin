import { useCallback, useEffect, useReducer, useRef } from "react";
import { PING_INTERVAL_MS, PONG_TIMEOUT_MS } from "@/lib/chat/constants";
import {
  type DmSendFrame,
  type DmState,
  dmReducer,
  findOutgoing,
  initialDmState,
  isTerminalStatus,
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
import { reloadPage } from "@/lib/reload-page";

/** A peer's typing indicator clears after this long without a refresh. */
const TYPING_STALE_MS = 8_000;
/** A request the room never answers settles after this long. Keep it above
 *  the room's worst-case op latency. */
const REQUEST_TIMEOUT_MS = 10_000;
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

/** An old bundle against a new protocol: reload once, not in a loop. When
 *  this declines, the screen asks the user to refresh instead. */
function reloadForVersion() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Storage blocked: reloading once more is still the right call.
  }
  reloadPage();
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
  // Non-null only while `live`: the effect below opens it and its cleanup,
  // or a terminal close, drops it.
  const socketRef = useRef<ReconnectingSocket | null>(null);
  const waiters = useRef(new Map<string, (r: OpResult) => void>());
  const readSent = useRef(0);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  });
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const sendFrame = useCallback((frame: DmFrame) => {
    return socketRef.current?.send(JSON.stringify(frame)) ?? false;
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      dispatch({
        type: document.visibilityState === "visible" ? "resume" : "pause",
      });
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const live = !isTerminalStatus(state.status) && state.status !== "paused";

  useEffect(() => {
    if (!live) return;
    if (document.visibilityState !== "visible") {
      dispatch({ type: "pause" });
      return;
    }
    let tooMany = 0;
    const settle = (id: string, result: OpResult) => {
      waiters.current.get(id)?.(result);
      waiters.current.delete(id);
    };
    const stop = (status: "unavailable" | "busy" | "outdated") => {
      socketRef.current?.close();
      socketRef.current = null;
      dispatch({ type: "status", status });
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
          // Sends still waiting on the server go out again. The server
          // dedupes on the op id, so a replay can't double-post.
          for (const m of stateRef.current.messages) {
            if (m.frame && m.delivery === "sending") {
              socketRef.current?.send(JSON.stringify(m.frame));
            }
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
          settle(frame.id, { ok: true });
          return;
        case "meta":
          dispatch({ type: "meta", meta: frame.meta });
          return;
        case "typing":
          dispatch({ type: "typing", on: frame.on, at: Date.now() });
          return;
        case "ack":
          settle(frame.id, { ok: true });
          return;
        case "err":
          if (!frame.id) return;
          if (
            findOutgoing(stateRef.current.messages, frame.id)?.delivery ===
            "sending"
          ) {
            dispatch({ type: "failed", clientId: frame.id });
            onErrorRef.current?.(frame.code);
          }
          settle(frame.id, { ok: false, code: frame.code });
      }
    };

    readSent.current = 0;
    socketRef.current = createReconnectingSocket({
      url: () => wsUrl(username),
      keepalive: {
        ping: PING,
        pong: PONG,
        intervalMs: PING_INTERVAL_MS,
        timeoutMs: PONG_TIMEOUT_MS,
      },
      // Visibility is handled above: a hidden page pauses, which closes the
      // socket.
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
          stop("busy");
          return;
        }
        if (code === CLOSE.VERSION) {
          reloadForVersion();
          stop("outdated");
          return;
        }
        if (!willReconnect) {
          stop("unavailable");
          return;
        }
        dispatch({ type: "status", status: "reconnecting" });
      },
    });

    return () => {
      // close() suppresses onClose, which is what normally settles these.
      // oxlint-disable-next-line react-hooks/exhaustive-deps -- the waiters map is meant to be read at teardown
      for (const id of [...waiters.current.keys()]) {
        settle(id, { ok: false, code: "offline" });
      }
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [username, live]);

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
      const frame: DmSendFrame = {
        t: "send",
        id: crypto.randomUUID(),
        text,
        ...(replyTo ? { replyTo: replyTo.id } : {}),
      };
      dispatch({ type: "send", frame, replyTo, at: Date.now() });
      // Offline: it stays "sending" and goes out with the next sync.
      sendFrame(frame);
    },
    [sendFrame],
  );

  const retry = useCallback(
    (clientId: string) => {
      const outgoing = findOutgoing(stateRef.current.messages, clientId);
      if (outgoing?.delivery !== "failed") return;
      dispatch({ type: "retry", clientId });
      // Offline: it goes out with the next sync, like a fresh send.
      sendFrame(outgoing.frame);
    },
    [sendFrame],
  );

  const request = useCallback(
    (frame: DmFrame & { id: string }): Promise<OpResult> => {
      if (!sendFrame(frame)) {
        return Promise.resolve({ ok: false, code: "offline" });
      }
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          waiters.current.delete(frame.id);
          resolve({ ok: false, code: "unavailable" });
        }, REQUEST_TIMEOUT_MS);
        waiters.current.set(frame.id, (r) => {
          clearTimeout(timer);
          resolve(r);
        });
      });
    },
    [sendFrame],
  );

  const react = useCallback(
    (messageId: string, emoji: string) =>
      request({ t: "react", id: crypto.randomUUID(), messageId, emoji }),
    [request],
  );

  const unsend = useCallback(
    (messageId: string) =>
      request({ t: "unsend", id: crypto.randomUUID(), messageId }),
    [request],
  );

  const report = useCallback(
    (messageId: string, reason: DmReportReason) =>
      request({ t: "report", id: crypto.randomUUID(), messageId, reason }),
    [request],
  );

  // Without the React Compiler, a fresh setTyping per frame would re-run the
  // composer's cleanup and send typing:off mid-sentence.
  const setTyping = useCallback(
    (on: boolean) => {
      sendFrame({ t: "typing", on });
    },
    [sendFrame],
  );

  const loadOlder = useCallback(() => {
    const current = stateRef.current;
    const oldest = current.messages.find((m) => !m.id.startsWith("local:"));
    if (!oldest || current.loadingOlder || !current.hasMore) return;
    dispatch({ type: "loadOlder" });
    void request({
      t: "history",
      id: crypto.randomUUID(),
      before: oldest.id,
    }).then((r) => {
      if (!r.ok) dispatch({ type: "loadOlderFailed" });
    });
  }, [request]);

  return {
    state,
    peerTyping,
    send,
    retry,
    react,
    unsend,
    report,
    setTyping,
    loadOlder,
  };
}
