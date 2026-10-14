// Umamin Chat constants shared by the Durable Objects, the client transport and
// the UI. Gameplay values are carried over unchanged from the Convex build.

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;

/** How long a lone queuer waits for an interest match before pairing with anyone. */
export const FALLBACK_MS = 4 * SECOND;
/** A queued socket is closed after this long so a forgotten desktop tab doesn't
 *  sit in the pool; the client offers to search again. */
export const MAX_QUEUE_WAIT_MS = 10 * MINUTE;
/** Grace after a match ends before the room purges its storage. */
export const GRACE_MS = 60 * SECOND;
/** A fresh match ends as partner-left if both sides haven't authenticated
 *  within this window. */
export const MATCH_START_GRACE_MS = 20 * SECOND;
/** Once both sides have been seen, a side must be continuously absent this long
 *  before the match ends. Covers app switches, screen locks, network blips and
 *  every deploy (deploys restart Durable Objects and drop all sockets). */
export const AWAY_GRACE_MS = 90 * SECOND;
/** Backstop liveness check for rooms that receive no frames. Busy rooms check on
 *  every incoming frame for free, so this only has to catch silent ones; a
 *  shorter interval is a billed alarm per room per interval. */
export const SWEEP_INTERVAL_MS = 5 * MINUTE;
/** An active match with no new message for this long ends at the next sweep.
 *  Two forgotten-but-open tabs would otherwise keep a room (and its sweep
 *  alarm) alive indefinitely. */
export const IDLE_MATCH_MS = 60 * MINUTE;
/** Sockets one room accepts (both sides, all tabs). */
export const MAX_ROOM_SOCKETS = 8;
/** Client keepalive cadence. Answered by the runtime's auto-response, so it
 *  never wakes (or bills) the object. */
export const PING_INTERVAL_MS = 25 * SECOND;
/** The client treats a socket as dead when a ping goes unanswered this long. */
export const PONG_TIMEOUT_MS = 10 * SECOND;
/** A socket whose last auto-response is older than this is half-open. */
export const STALE_SOCKET_MS = 75 * SECOND;
/** A socket that hasn't sent its join/auth frame by now is closed. */
export const AUTH_DEADLINE_MS = 5 * SECOND;

/** Max messages in a sync payload (conversations are short and ephemeral). */
export const MESSAGE_CAP = 100;
/** A retried send is matched against this many of the newest messages. A
 *  bounded rowid range scan, so dedupe needs no index (no extra write). */
export const SEND_DEDUPE_WINDOW = 64;
/** Hard cap on stored messages per match; bounds storage for marathon or
 *  abusive rooms. At the send rate limit this is over five hours of chat. */
export const MAX_ROOM_MESSAGES = 10_000;
/** Max characters in a single message. */
export const MAX_MESSAGE_LEN = 2000;
/** Frames longer than this are rejected before parsing. Sized for a
 *  max-length message of 4-byte characters plus the envelope. */
export const MAX_FRAME_CHARS = 12_000;
/** Quoted-reply previews are truncated server-side so a reply to a long
 *  message doesn't double the payload. */
export const REPLY_PREVIEW_LEN = 140;
/** How long a revealed whisper stays readable before the room redacts it. */
export const WHISPER_BURN_MS = 10 * SECOND;

/** Send effects are a fixed allowlist, not arbitrary user content. */
export const ALLOWED_EFFECTS = [
  "confetti",
  "hearts",
  "sparkles",
  "poof",
  "golden",
] as const;
export type SendEffect = (typeof ALLOWED_EFFECTS)[number];
/** Vibe level required to send an effect (absent = 1). The engine enforces it;
 *  the dimmed tiles in the composer sheet are UX only. */
export const EFFECT_MIN_LEVEL: Partial<Record<SendEffect, number>> = {
  sparkles: 3,
  poof: 4,
  golden: 5,
};

/** Client-generated anonymous session credentials. */
export const MAX_SESSION_ID_LEN = 128;
export const MAX_SESSION_SECRET_LEN = 128;
/** Invite codes are client-generated and opaque; only their length is bounded. */
export const MAX_INVITE_CODE_LEN = 32;
/** The stay-connected reveal handle is the one deliberate PII exception: never
 *  log it, never echo it in an error, never put it on a share card. It is
 *  deleted with the room. */
export const MAX_REVEAL_HANDLE_LEN = 64;
export const MAX_ALIAS_LEN = 40;
export const MAX_AVATAR_SEED_LEN = 64;
export const MAX_INTERESTS = 24;
export const MAX_INTEREST_LEN = 48;

/** Reactions are a fixed UI affordance. Each side gets one reaction per message. */
export const ALLOWED_REACTIONS = [
  "❤️",
  "😂",
  "🔥",
  "😮",
  "👍",
  "😢",
  "🫶",
  "🥹",
];
/** Vibe level required to SET a reaction (absent = 1); clearing is always allowed. */
export const REACTION_MIN_LEVEL: Record<string, number> = {
  "🫶": 2,
  "🥹": 3,
};
