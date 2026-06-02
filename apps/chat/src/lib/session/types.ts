export type SessionPhase = "idle" | "matching" | "active" | "ended";

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
  /** Interest ids shared with self. */
  sharedInterests: string[];
  status: PartnerStatus;
}

export interface ChatMessage {
  id: string;
  author: "self" | "partner";
  text: string;
  ts: number;
  /** Emoji reactions currently applied to this message. */
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
