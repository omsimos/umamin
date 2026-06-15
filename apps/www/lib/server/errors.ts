import "server-only";

// Canonical user-facing error strings. Single source so call sites can't
// drift (the codebase had both "occurred" and a misspelled "occured").
export const GENERIC_ERROR = "An error occurred";
export const INVALID_INPUT_ERROR = "Invalid input";
export const UNAUTHENTICATED_ERROR = "User not authenticated";
export const UNAUTHORIZED_ERROR = "Unauthorized";
export const INTERNAL_SERVER_ERROR = "Internal server error";

// Shown when a request's IP is on the moderator-managed denylist (lib/server/
// ip-denylist.ts). Distinct from a rate limit so the user isn't told to retry.
export const ACCESS_BLOCKED_ERROR = "Your access has been blocked.";

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
