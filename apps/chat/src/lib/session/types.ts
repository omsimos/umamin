/** "loading" is transport-only — the reactive query hasn't resolved yet (e.g. on
 *  a fresh page load / reload); the server never emits it. The UI must hold on
 *  "loading" rather than treat it as "no session". */
export type SessionPhase = "loading" | "idle" | "matching" | "active" | "ended";

/** "away" = no live heartbeat while the match is still active (app switch,
 *  screen lock, network blip) — the server only ends the match once the
 *  absence outlasts its away grace. "left" = the match has ended. */
export type PartnerStatus = "online" | "typing" | "away" | "left";

export type EndedReason = "self-ended" | "partner-left";

export interface SelfIdentity {
  alias: string;
  avatarSeed: string;
  /** Interest ids (see lib/content.ts INTERESTS). */
  interests: string[];
}

export interface Partner {
  alias: string;
  avatarSeed: string;
  sharedInterests: string[];
  status: PartnerStatus;
}

/** One reaction per user per message; "by" is the viewer's perspective. */
export interface MessageReaction {
  emoji: string;
  by: "self" | "partner";
}

/** Snapshot of a quoted reply target, resolved server-side to the viewer's
 *  perspective; text is truncated to REPLY_PREVIEW_LEN. */
export interface ReplyPreview {
  id: string;
  author: "self" | "partner";
  text: string;
}

export type SendEffect = "confetti" | "hearts" | "sparkles" | "poof" | "golden";

/** Burn-on-read lifecycle. While "hidden" the recipient's `text` is empty —
 *  the plaintext is withheld server-side until they reveal; after "burned"
 *  both sides get an empty `text`. `viewedAt` is present only while
 *  "revealed" and anchors the client countdown. */
export interface WhisperState {
  state: "hidden" | "revealed" | "burned";
  viewedAt?: number;
}

/** "match" — both answer for themselves, equal picks score. "guess" (Mind
 *  Reader) — the dealer answers truthfully and the partner predicts the
 *  dealer's pick; a correct prediction scores. */
export type GameMode = "match" | "guess";

/** A completed game round recorded in the conversation, viewer-relative.
 *  Such rows carry no text and render as a centered system-style card.
 *  mode/dealtBy are absent on pre-deploy rows (read as a "match" round). */
export interface GameResult {
  cardId: string;
  selfPick: "A" | "B";
  partnerPick: "A" | "B";
  mode?: GameMode;
  dealtBy?: "self" | "partner";
}

export interface ChatMessage {
  id: string;
  author: "self" | "partner";
  text: string;
  ts: number;
  reactions: MessageReaction[];
  replyTo?: ReplyPreview;
  whisper?: WhisperState;
  effect?: SendEffect;
  gameResult?: GameResult;
}

export interface SendOpts {
  replyToId?: string;
  whisper?: boolean;
  effect?: SendEffect;
}

export type GamePick = "A" | "B";

/** The active game round, viewer-relative. `partnerPick` is present only once
 *  both sides have answered — the server withholds it until the reveal. */
export interface GameRound {
  cardId: string;
  dealtBy: "self" | "partner";
  mode: GameMode;
  selfPick: GamePick | null;
  partnerAnswered: boolean;
  partnerPick?: GamePick;
}

export interface GameTally {
  rounds: number;
  matched: number;
}

export const EMPTY_TALLY: GameTally = { rounds: 0, matched: 0 };

export interface GuessTally {
  rounds: number;
  correct: number;
}

export const EMPTY_GUESS_TALLY: GuessTally = { rounds: 0, correct: 0 };

/** Consecutive successful rounds across both modes; `best` is the high-water
 *  mark for the match. */
export interface GameStreak {
  current: number;
  best: number;
}

export const EMPTY_STREAK: GameStreak = { current: 0, best: 0 };

/** Shared per-match chemistry — identical for both viewers; levels unlock
 *  decks, modes, effects, and reactions. */
export interface VibeState {
  score: number;
  level: number;
}

export const EMPTY_VIBE: VibeState = { score: 0, level: 1 };

export interface RevealSide {
  submitted: boolean;
  /** Self: own echo, always present once submitted. Partner: present ONLY
   *  once both sides have submitted — the server withholds it until then. */
  handle?: string;
}

/** Stay-connected reveal. `unlocked` = both tapped the heart. */
export interface RevealState {
  unlocked: boolean;
  self: RevealSide;
  partner: RevealSide;
}

export const EMPTY_REVEAL: RevealState = {
  unlocked: false,
  self: { submitted: false },
  partner: { submitted: false },
};

export interface SessionSnapshot {
  phase: SessionPhase;
  /** Stable id for the current match; "" when idle. */
  matchId: string;
  self: SelfIdentity;
  partner: Partner | null;
  messages: ChatMessage[];
  stayConnected: { self: boolean; partner: boolean };
  game: GameRound | null;
  gameTally: GameTally;
  guessTally: GuessTally;
  gameStreak: GameStreak;
  vibe: VibeState;
  reveal: RevealState;
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
export interface FindMatchOptions {
  /** Caller's own shareable code — stamped on their queue row so deep-link
   *  visitors can land on them whenever they're searching. */
  inviteCode?: string;
  /** One-shot code from a ?join= deep link. Never persisted, never replayed
   *  on a rematch. */
  joinCode?: string;
  /** The joinCode's owner wasn't claimable (absent/stale/self) — the caller
   *  was matched normally instead. */
  onInviteMiss?: () => void;
}

export interface ChatTransport {
  subscribe(listener: (snapshot: SessionSnapshot) => void): () => void;
  getSnapshot(): SessionSnapshot;
  findMatch(self: SelfIdentity, options?: FindMatchOptions): void;
  send(text: string, opts?: SendOpts): void;
  react(messageId: string, emoji: string): void;
  /** Recipient-only: reveal a whisper and start its burn timer. */
  viewWhisper(messageId: string): void;
  /** Deal a game card to both players — replaces any round in flight. */
  dealCard(cardId: string, mode?: GameMode): void;
  answerCard(cardId: string, pick: GamePick): void;
  dismissGame(): void;
  /** Best-effort: delivery is not guaranteed. */
  setTyping(isTyping: boolean): void;
  signalStayConnected(): void;
  /** Submit (or replace, pre-reveal) the own stay-connected handle. */
  submitRevealHandle(handle: string): void;
  /** Withdraw the own handle — no-op once mutually revealed. */
  withdrawRevealHandle(): void;
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
  game: null,
  gameTally: EMPTY_TALLY,
  guessTally: EMPTY_GUESS_TALLY,
  gameStreak: EMPTY_STREAK,
  vibe: EMPTY_VIBE,
  reveal: EMPTY_REVEAL,
};

/** Returned by the Convex transport while the snapshot query is unresolved, so
 *  the route holds instead of bouncing to the lobby on a transient idle. */
export const LOADING_SNAPSHOT: SessionSnapshot = {
  ...IDLE_SNAPSHOT,
  phase: "loading",
};
