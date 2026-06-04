export const SECOND = 1000;
export const MINUTE = 60 * SECOND;

/** How long a lone queuer waits for an interest match before pairing with anyone. */
export const FALLBACK_MS = 4 * SECOND;
/** Cadence of the per-match presence reconciliation (abandonment detection).
 *  The survivor's "away" status is derived reactively from presence in
 *  `snapshot`, but only reconcile flips the match to `ended` (which is what
 *  produces "left" and the ended overlay) — this cadence is the granularity of
 *  that decision, on top of AWAY_GRACE_MS. Larger = fewer per-match
 *  invocations; trade-off is up to this much extra latency on the
 *  ended-overlay once a grace has run out. MUST stay below
 *  MATCH_START_GRACE_MS so a fresh match gets at least one protected re-arm
 *  tick before any teardown. */
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
/** Client-generated anonymous session credentials. */
export const MAX_SESSION_ID_LEN = 128;
export const MAX_SESSION_SECRET_LEN = 128;
/** Server-side bounds on client-supplied identity. The lobby caps these too, but
 *  the matchmaking mutation is publicly callable, so the server must as well. */
export const MAX_ALIAS_LEN = 40;
export const MAX_AVATAR_SEED_LEN = 64;
export const MAX_INTERESTS = 24;
export const MAX_INTEREST_LEN = 48;
/** Reactions are a fixed UI affordance, not arbitrary user content. */
export const ALLOWED_REACTIONS = ["❤️", "😂", "🔥", "😮", "👍", "😢"];
export const MAX_REACTIONS_PER_MESSAGE = ALLOWED_REACTIONS.length;
/** Messages deleted per teardown transaction; a match with more pages re-arms
 *  deleteMatch so cleanup can't exceed a single mutation's write limit. */
export const MESSAGE_DELETE_PAGE = 256;
/** Age at which the cleanup sweep starts liveness-checking an active match.
 *  NOT a max chat length: the sweep only ends matches whose participants are
 *  genuinely gone (absent past the away grace) — a long conversation with two
 *  live clients is left alone. Exists for matches whose reconcile chain died
 *  (deploy, bug) so abandonment is still detected eventually. */
export const ACTIVE_MATCH_TTL_MS = 30 * MINUTE;
/** A fresh match is not torn down as "partner-left" until this long after
 *  creation unless both peers have been seen present — absorbs the time both
 *  clients need to mount presence and send a first heartbeat after pairing.
 *  Must stay above RECONCILE_MS (see above). */
export const MATCH_START_GRACE_MS = 20 * SECOND;
/** Once both peers have been seen live, a side must be continuously absent for
 *  this long before the match is ended as partner-left. Absorbs app switches,
 *  screen locks, tab switches, and network blips — none of which mean the
 *  person actually left. While inside the grace the partner reads as "away". */
export const AWAY_GRACE_MS = 90 * SECOND;
/** Client heartbeat cadence for match presence. The presence component marks a
 *  user offline 2.5x this after their last beat (75s) — wide enough that a
 *  background tab's throttled timers (~1/min) still keep its user online. Also
 *  the server-side cap on the client-supplied heartbeat interval. */
export const PRESENCE_HEARTBEAT_MS = 30 * SECOND;
/** Cadence of the matching radar's queue-liveness ping. */
export const QUEUE_PING_MS = 10 * SECOND;
/** A queue row whose last ping is older than this is not claimable — its tab is
 *  closed or backgrounded and could not establish match presence anyway. The
 *  row is kept (not deleted) so pings, and matchability, resume on return. */
export const QUEUE_FRESH_MS = 30 * SECOND;
