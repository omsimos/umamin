export const SECOND = 1000;
export const MINUTE = 60 * SECOND;

/** How long a lone queuer waits for an interest match before pairing with anyone. */
export const FALLBACK_MS = 4 * SECOND;
/** Cadence of the per-match presence reconciliation (abandonment detection).
 *  Kept above the heartbeat interval but coarse on purpose: the survivor's
 *  "partner left" status is derived directly from presence in `snapshot`
 *  (reactive, independent of this poll), so reconcile only needs to flip the
 *  match to `ended` + schedule cleanup. Larger = fewer per-match invocations;
 *  trade-off is up to this much latency on the ended-overlay after a graceful
 *  tab close. MUST stay below MATCH_START_GRACE_MS so a fresh match gets at
 *  least one protected re-arm tick before any teardown. */
export const RECONCILE_MS = 12 * SECOND;
/** Grace after a match ends before the match + messages are hard-deleted. */
export const GRACE_MS = 60 * SECOND;
/** A session not seen for this long is considered dead. */
export const SESSION_TTL_MS = 60 * MINUTE;
/** A queue row older than this with no match is swept. */
export const MAX_QUEUE_WAIT_MS = 5 * MINUTE;
/** Max messages returned in a snapshot (conversations are short/ephemeral). */
export const MESSAGE_CAP = 100;
/** Max characters in a single message (anti-abuse; far under Convex's 1 MiB doc cap). */
export const MAX_MESSAGE_LEN = 2000;
/** Server-side bounds on client-supplied identity. The lobby caps these too, but
 *  the matchmaking mutation is publicly callable, so the server must as well. */
export const MAX_ALIAS_LEN = 40;
export const MAX_AVATAR_SEED_LEN = 64;
export const MAX_INTERESTS = 24;
/** Messages deleted per teardown transaction; a match with more pages re-arms
 *  deleteMatch so cleanup can't exceed a single mutation's write limit. */
export const MESSAGE_DELETE_PAGE = 256;
/** A fresh match is not torn down as "partner-left" until this long after
 *  creation unless both peers have been seen present — absorbs the time both
 *  clients need to mount presence and send a first heartbeat after pairing.
 *  Must stay above RECONCILE_MS (see above). */
export const MATCH_START_GRACE_MS = 20 * SECOND;
