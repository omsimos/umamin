/** "loading" is transport-only — the reactive query hasn't resolved yet (e.g. on
 *  a fresh page load / reload); the server never emits it. The UI must hold on
 *  "loading" rather than treat it as "no session". */
export type SessionPhase = "loading" | "idle" | "matching" | "active" | "ended";

export type PartnerStatus = "online" | "typing" | "left";

export type EndedReason = "self-ended" | "partner-left";

export interface SelfIdentity {
  alias: string;
  avatarSeed: string;
  /** Interest ids (see lib/mock/data.ts INTERESTS). */
  interests: string[];
}

export interface Partner {
  alias: string;
  avatarSeed: string;
  sharedInterests: string[];
  status: PartnerStatus;
}

export interface ChatMessage {
  id: string;
  author: "self" | "partner";
  text: string;
  ts: number;
  reactions: string[];
}

export interface SessionSnapshot {
  phase: SessionPhase;
  /** Stable id for the current match; "" when idle. */
  matchId: string;
  self: SelfIdentity;
  partner: Partner | null;
  messages: ChatMessage[];
  stayConnected: { self: boolean; partner: boolean };
  endedReason?: EndedReason;
}

/**
 * The snapshot minus its message list. On Convex this is its own reactive query
 * (`chat.snapshot`) so partner status / typing / stay-connected changes don't
 * re-read the message list; `chat.messages` carries the list separately and the
 * transport merges them back into a `SessionSnapshot` for the UI.
 */
export type SnapshotMeta = Omit<SessionSnapshot, "messages">;

/**
 * The single seam between the UI and the "other side".
 * mockTransport implements it now; a Convex transport will implement the same
 * shape later (subscribe ~ useQuery, getSnapshot ~ initial query value, the
 * action methods ~ mutations). The UI never imports a concrete transport.
 */
export interface ChatTransport {
  subscribe(listener: (snapshot: SessionSnapshot) => void): () => void;
  getSnapshot(): SessionSnapshot;
  findMatch(self: SelfIdentity): void;
  send(text: string): void;
  react(messageId: string, emoji: string): void;
  /** Best-effort: delivery is not guaranteed. */
  setTyping(isTyping: boolean): void;
  signalStayConnected(): void;
  leave(reason?: EndedReason): void;
}

const EMPTY_SELF: SelfIdentity = {
  alias: "",
  avatarSeed: "",
  interests: [],
};

export const IDLE_SNAPSHOT: SessionSnapshot = {
  phase: "idle",
  matchId: "",
  self: EMPTY_SELF,
  partner: null,
  messages: [],
  stayConnected: { self: false, partner: false },
};

/** Returned by the Convex transport while the snapshot query is unresolved, so
 *  the route holds instead of bouncing to the lobby on a transient idle. */
export const LOADING_SNAPSHOT: SessionSnapshot = {
  ...IDLE_SNAPSHOT,
  phase: "loading",
};
