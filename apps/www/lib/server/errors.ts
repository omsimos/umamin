import "server-only";

// Canonical user-facing error strings. Single source so call sites can't
// drift (the codebase had both "occurred" and a misspelled "occured").
export const GENERIC_ERROR = "An error occurred";
export const INVALID_INPUT_ERROR = "Invalid input";
export const UNAUTHENTICATED_ERROR = "User not authenticated";
export const UNAUTHORIZED_ERROR = "Unauthorized";
export const INTERNAL_SERVER_ERROR = "Internal server error";

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
