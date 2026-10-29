// Direct message constants shared by the DmRoom Durable Object, the client
// transport and the UI.

import { MINUTE, SECOND } from "../chat/constants";

export { ALLOWED_REACTIONS as DM_REACTIONS } from "../chat/constants";

/** Max characters in one message, the same as an anonymous message. */
export const MAX_DM_LEN = 2000;
/** Frames longer than this are rejected before parsing. Sized for a
 *  max-length message of 4-byte characters plus the envelope. */
export const MAX_DM_FRAME_CHARS = 10_000;
/** Messages per sync or history page. */
export const DM_PAGE_SIZE = 30;
/** A retried send is matched against this many of the newest messages. */
export const DM_DEDUPE_WINDOW = 64;
/** Sockets one side may hold open (tabs and devices). */
export const MAX_SOCKETS_PER_SIDE = 4;
/** Turso thread-row writes for a busy conversation are coalesced into one per
 *  window. Writes that change what the recipient's list shows as unread skip
 *  the wait. */
export const THREAD_SYNC_DEBOUNCE_MS = 10 * SECOND;
/** An open socket re-checks mutual follow and blocks this often before it
 *  accepts a send. Block and unfollow also sever sockets directly. */
export const ACCESS_RECHECK_MS = 5 * MINUTE;
/** At most one push per conversation per recipient in this window. */
export const PUSH_COOLDOWN_MS = 5 * MINUTE;
/** A half-open socket is closed once its last pong is older than this. */
export const DM_STALE_SOCKET_MS = 75 * SECOND;
/** An open socket is closed (reconnectably) after this long, so the upgrade
 *  route re-checks the session. Bounds how long a revoked session can read. */
export const DM_MAX_SOCKET_AGE_MS = 60 * MINUTE;
/** Characters of the latest message kept (encrypted) for the Chats list. */
export const DM_PREVIEW_MAX = 80;
/** Messages before the reported one that go into a report snapshot. */
export const REPORT_CONTEXT = 10;
/** One report per reporter per conversation in this window. */
export const REPORT_COOLDOWN_MS = 60 * MINUTE;
/** Threads shown in the Chats list per page, and the cap on the unread
 *  count (shown as "20+"). */
export const DM_THREADS_PAGE_SIZE = 20;

export const DM_REPORT_REASONS = [
  "harassment",
  "sexual",
  "minor_safety",
  "spam",
  "other",
] as const;
