// Canonical user-facing error strings. Single source so call sites can't drift.
// Ported verbatim from apps/www/lib/server/errors.ts (minus `server-only`, which
// has no meaning in the Worker bundle — server-lib is never shipped to a client).
export const GENERIC_ERROR = "An error occurred";
export const INVALID_INPUT_ERROR = "Invalid input";
export const UNAUTHENTICATED_ERROR = "User not authenticated";
export const UNAUTHORIZED_ERROR = "Unauthorized";
export const INTERNAL_SERVER_ERROR = "Internal server error";

// Read-route early exits. apps/www inlined these literals per route; they are
// constants here because the Hono routes emit them from ~25 call sites.
export const NOT_FOUND_ERROR = "Not found";
export const MEMBERS_ONLY_ERROR = "Members only";
// The follow-list routes say "User not found" specifically — keep the wording
// apps/www shipped; the client surfaces it verbatim.
export const USER_NOT_FOUND_ERROR = "User not found";

// Shown when a request's IP is on the moderator-managed denylist.
export const ACCESS_BLOCKED_ERROR = "Your access has been blocked.";

// Turnstile rejected or could not verify the token. Deliberately distinct from
// INCORRECT on login: it says nothing about whether the account exists, so it
// adds no enumeration signal, and a generic failure would read as a wrong
// password and send people resetting a password that works.
export const VERIFICATION_FAILED_ERROR =
  "Couldn't verify you're human. Please try again.";

// Shown to a banned account that still tries to act (the OAuth path redirects
// to /banned instead). The reason is moderator-entered and bounded to 500 chars.
export const ACCOUNT_SUSPENDED_ERROR = "Your account has been suspended.";
export function accountSuspendedMessage(reason?: string | null): string {
  return reason
    ? `${ACCOUNT_SUSPENDED_ERROR} Reason: ${reason}`
    : ACCOUNT_SUSPENDED_ERROR;
}

/**
 * True when `err` is a SQLite unique-constraint violation on the given
 * column (e.g. "user.username"). Drizzle surfaces the driver error as
 * `Error.cause`.
 */
export function isUniqueConstraintViolation(
  err: unknown,
  column: string,
): boolean {
  if (
    !(err instanceof Error) ||
    typeof err.cause !== "object" ||
    err.cause === null
  ) {
    return false;
  }

  const cause = err.cause as { code?: string; message?: string };
  return (
    cause.code === "SQLITE_CONSTRAINT" && !!cause.message?.includes(column)
  );
}

// Cap per link: drizzle's DrizzleQueryError message embeds the full SQL AND its
// bound params, which on this app can be user content (a message body, a
// username). The cause link — the part worth reading — is never truncated by
// this, it is described separately below.
const MAX_MESSAGE_LENGTH = 300;
const MAX_CAUSE_DEPTH = 5;

function describe(error: unknown): string {
  if (error instanceof Error) {
    const { code } = error as { code?: unknown };
    const message =
      error.message.length > MAX_MESSAGE_LENGTH
        ? `${error.message.slice(0, MAX_MESSAGE_LENGTH)}…`
        : error.message;
    const head = message ? `${error.name}: ${message}` : error.name;
    return code === undefined ? head : `${head} [${String(code)}]`;
  }

  if (typeof error === "object" && error !== null) {
    try {
      return JSON.stringify(error).slice(0, MAX_MESSAGE_LENGTH);
    } catch {
      return String(error);
    }
  }

  return String(error);
}

// V8 prefixes `stack` with "Name: message"; the chain already carries that, so
// drop the duplicate. An error built with Error.captureStackTrace (see below)
// has no such prefix and is returned whole.
function stackFrames(error: unknown): string | undefined {
  if (!(error instanceof Error) || !error.stack) return undefined;
  const head = `${error.name}: ${error.message}`;
  return error.stack.startsWith(head)
    ? error.stack.slice(head.length).replace(/^\r?\n/, "")
    : error.stack;
}

/**
 * Flatten an error and its `cause` chain into one loggable string.
 *
 * workerd's console logs an Error as its `stack` alone, and drizzle wraps EVERY
 * driver failure in a `DrizzleQueryError` built with `Error.captureStackTrace`,
 * whose stack therefore carries no leading message line. The real failure — the
 * `LibsqlError` with Turso's status and message — sits in `.cause` and was never
 * serialized, so a total Turso outage reached Workers Logs as a bare stack with
 * no reason attached (dev, 2026-08-23). Log this instead of the raw error.
 */
export function formatErrorChain(error: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;

  for (let depth = 0; depth <= MAX_CAUSE_DEPTH; depth += 1) {
    if (current === undefined || current === null || seen.has(current)) break;
    seen.add(current);
    parts.push(
      depth === 0 ? describe(current) : `caused by: ${describe(current)}`,
    );
    current = current instanceof Error ? current.cause : undefined;
  }

  const frames = stackFrames(error);
  return frames ? `${parts.join("\n")}\n${frames}` : parts.join("\n");
}
