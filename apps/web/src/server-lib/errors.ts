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
