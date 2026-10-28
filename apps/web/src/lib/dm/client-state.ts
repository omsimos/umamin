/**
 * The conversation screen's state as a pure reducer over server frames and
 * local intents, so merge rules (optimistic sends, edits, history pages) are
 * testable without a socket.
 */
import type { DmMessage, DmMeta, DmReplyPreview } from "./types";

export type DmDelivery = "sending" | "failed";

export interface UiDmMessage extends DmMessage {
  /** Set on optimistic sends until the server's copy replaces them. */
  delivery?: DmDelivery;
}

export type DmStatus =
  | "connecting"
  | "open"
  | "reconnecting"
  /** Blocked, unknown user, or flag off: the screen explains, no retry. */
  | "unavailable"
  /** Refused repeatedly for too many open sockets: the screen explains, no retry. */
  | "busy";

export interface DmState {
  status: DmStatus;
  messages: UiDmMessage[];
  meta: DmMeta | null;
  hasMore: boolean;
  loadingOlder: boolean;
  /** When the peer's last "typing on" arrived; null when not typing. */
  peerTypingAt: number | null;
}

export const initialDmState: DmState = {
  status: "connecting",
  messages: [],
  meta: null,
  hasMore: false,
  loadingOlder: false,
  peerTypingAt: null,
};

export type DmAction =
  | { type: "status"; status: DmStatus }
  | { type: "sync"; messages: DmMessage[]; meta: DmMeta; hasMore: boolean }
  | { type: "msgs"; messages: DmMessage[] }
  | { type: "history"; messages: DmMessage[]; hasMore: boolean }
  | { type: "meta"; meta: DmMeta }
  | { type: "typing"; on: boolean; at: number }
  | { type: "loadOlder" }
  | {
      type: "send";
      clientId: string;
      text: string;
      replyTo: DmReplyPreview | null;
      at: number;
    }
  | { type: "failed"; clientId: string }
  | { type: "retry"; clientId: string };

export const localId = (clientId: string) => `local:${clientId}`;

const isLocal = (m: UiDmMessage) => m.id.startsWith("local:");

function order(messages: UiDmMessage[]): UiDmMessage[] {
  const server = messages
    .filter((m) => !isLocal(m))
    .sort((a, b) => Number(a.id) - Number(b.id));
  return [...server, ...messages.filter(isLocal)];
}

/** Upserts server messages, dropping any optimistic copy they confirm. */
function merge(current: UiDmMessage[], incoming: DmMessage[]): UiDmMessage[] {
  const confirmed = new Set(
    incoming.map((m) => m.clientId).filter((c): c is string => !!c),
  );
  const byId = new Map(
    current
      .filter((m) => !(isLocal(m) && m.clientId && confirmed.has(m.clientId)))
      .map((m) => [m.id, m]),
  );
  for (const m of incoming) byId.set(m.id, m);
  // An unsend arrives as the target alone; replies already on screen still
  // quote its text until they're scrubbed here.
  const unsent = new Set(
    incoming.filter((m) => m.text === null).map((m) => m.id),
  );
  const messages = [...byId.values()].map((m) =>
    m.replyTo && m.replyTo.text !== null && unsent.has(m.replyTo.id)
      ? { ...m, replyTo: { ...m.replyTo, text: null } }
      : m,
  );
  return order(messages);
}

export function dmReducer(state: DmState, action: DmAction): DmState {
  switch (action.type) {
    case "status":
      return {
        ...state,
        status: action.status,
        // A dropped socket can't deliver the peer's "typing off".
        peerTypingAt: action.status === "open" ? state.peerTypingAt : null,
      };
    case "sync": {
      // A (re)connect replaces server history with the newest page and keeps
      // sends still waiting on an ack, unless the page already has them.
      const pending = state.messages.filter(isLocal);
      return {
        ...state,
        status: "open",
        meta: action.meta,
        hasMore: action.hasMore,
        loadingOlder: false,
        messages: merge(pending, action.messages),
      };
    }
    case "msgs":
      return {
        ...state,
        messages: merge(state.messages, action.messages),
        // A message from the peer ends their typing.
        peerTypingAt: action.messages.some((m) => !m.mine)
          ? null
          : state.peerTypingAt,
      };
    case "history":
      return {
        ...state,
        hasMore: action.hasMore,
        loadingOlder: false,
        messages: merge(state.messages, action.messages),
      };
    case "meta":
      return { ...state, meta: action.meta };
    case "typing":
      return { ...state, peerTypingAt: action.on ? action.at : null };
    case "loadOlder":
      return { ...state, loadingOlder: true };
    case "send":
      return {
        ...state,
        messages: order([
          ...state.messages,
          {
            id: localId(action.clientId),
            clientId: action.clientId,
            mine: true,
            text: action.text,
            replyTo: action.replyTo,
            myReaction: null,
            theirReaction: null,
            createdAt: action.at,
            delivery: "sending",
          },
        ]),
      };
    case "failed":
    case "retry":
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === localId(action.clientId)
            ? {
                ...m,
                delivery: action.type === "failed" ? "failed" : "sending",
              }
            : m,
        ),
      };
  }
}

/** The newest message from the peer, which a visible screen marks read. */
export function lastPeerSeq(messages: UiDmMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m && !m.mine && !isLocal(m)) return Number(m.id);
  }
  return 0;
}

/** The newest of my messages the peer has read, for the "Seen" marker. */
export function seenMessageId(
  messages: UiDmMessage[],
  peerReadSeq: number,
): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m?.mine && !isLocal(m) && Number(m.id) <= peerReadSeq) return m.id;
  }
  return null;
}
