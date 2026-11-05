// Turso's HTTP edge in front of the database occasionally answers a single
// request with a gateway error, or cuts a response body short. Those are
// one-off failures on the path to Tokyo, not query failures, so the same read
// issued again a moment later almost always succeeds.

import { DrizzleQueryError } from "drizzle-orm/errors";

const TRANSIENT_HTTP_STATUSES = new Set([502, 503, 504, 520]);
const MAX_CAUSE_DEPTH = 8;
const RETRY_DELAY_MIN_MS = 50;
const RETRY_DELAY_JITTER_MS = 50;

function causeOf(error: unknown): unknown {
  return error instanceof Error ? error.cause : undefined;
}

// LibsqlError keeps the HTTP status on its HttpServerError cause. Fall back to
// the message, which the driver formats as "Server returned HTTP status 502".
function httpStatusOf(error: Error): number | undefined {
  for (
    let current: unknown = error, depth = 0;
    current instanceof Error && depth <= MAX_CAUSE_DEPTH;
    current = causeOf(current), depth += 1
  ) {
    const status = (current as { status?: unknown }).status;
    if (typeof status === "number") return status;
    const match = /HTTP status (\d{3})/.exec(current.message);
    if (match) return Number(match[1]);
  }
  return undefined;
}

function isLibsqlServerError(error: Error): boolean {
  return (
    error.name === "LibsqlError" &&
    (error as { code?: unknown }).code === "SERVER_ERROR"
  );
}

/**
 * True for a failure worth one more attempt: a libSQL SERVER_ERROR carrying a
 * gateway status, or a truncated JSON body the driver failed to parse. The
 * SyntaxError only counts below a driver error (Drizzle wraps every query
 * failure), so a JSON.parse bug in our own code is never retried.
 */
export function isTransientDbError(error: unknown): boolean {
  let insideDriverError = false;
  for (
    let current = error, depth = 0;
    current instanceof Error && depth <= MAX_CAUSE_DEPTH;
    current = causeOf(current), depth += 1
  ) {
    if (isLibsqlServerError(current)) {
      const status = httpStatusOf(current);
      return status !== undefined && TRANSIENT_HTTP_STATUSES.has(status);
    }
    if (
      insideDriverError &&
      current instanceof SyntaxError &&
      /JSON/.test(current.message)
    ) {
      return true;
    }
    if (
      current instanceof DrizzleQueryError ||
      current.name === "LibsqlError"
    ) {
      insideDriverError = true;
    }
  }
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run an idempotent read, and run it once more after a short jittered pause
 * when the first attempt fails transiently. The second failure is thrown as-is.
 *
 * Never wrap a write in this. A gateway error can arrive after the database
 * committed, so a retried write can apply twice.
 */
export async function retryTransientRead<T>(
  run: () => Promise<T>,
  onRetry?: () => void,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!isTransientDbError(error)) throw error;
    onRetry?.();
    await delay(RETRY_DELAY_MIN_MS + Math.random() * RETRY_DELAY_JITTER_MS);
    return run();
  }
}
