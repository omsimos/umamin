export const SECOND = 1000;
export const MINUTE = 60 * SECOND;

/** How long a lone queuer waits for an interest match before pairing with anyone. */
export const FALLBACK_MS = 4 * SECOND;
/** Cadence of the per-match presence reconciliation (abandonment detection). */
export const RECONCILE_MS = 8 * SECOND;
/** Grace after a match ends before the match + messages are hard-deleted. */
export const GRACE_MS = 60 * SECOND;
/** A session not seen for this long is considered dead. */
export const SESSION_TTL_MS = 60 * MINUTE;
/** A queue row older than this with no match is swept. */
export const MAX_QUEUE_WAIT_MS = 5 * MINUTE;
/** Max messages returned in a snapshot (conversations are short/ephemeral). */
export const MESSAGE_CAP = 100;
/** Presence considered stale (partner left) after this with no heartbeat. */
export const PRESENCE_STALE_MS = 15 * SECOND;
