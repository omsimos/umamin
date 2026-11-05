import { RequestFailedError } from "@/lib/request-error";

// Chrome says "Failed to fetch", Safari "Load failed", Firefox "NetworkError
// when attempting to fetch resource.". A TypeError with any other message is a
// bug in the queryFn, and retrying a bug only delays the error screen.
const NETWORK_ERROR_MESSAGE = /failed to fetch|load failed|networkerror/i;

export function isNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError && NETWORK_ERROR_MESSAGE.test(error.message)
  );
}

function isTransientStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 429;
}

/**
 * A dropped request on mobile data or a brief server hiccup. Every other 4xx
 * (401, 403, 404) is an answer, and asking again gets the same one.
 */
export function isTransientRequestError(error: unknown): boolean {
  if (isNetworkError(error)) return true;
  return error instanceof RequestFailedError && isTransientStatus(error.status);
}

export const MAX_QUERY_RETRIES = 2;
const RETRY_DELAYS_MS = [300, 1_000] as const;

export function shouldRetryQuery(
  failureCount: number,
  error: unknown,
): boolean {
  return failureCount < MAX_QUERY_RETRIES && isTransientRequestError(error);
}

// query-core passes the failures so far before counting this one: 0 on the
// first retry.
export function queryRetryDelay(failureCount: number): number {
  return RETRY_DELAYS_MS[
    Math.min(Math.max(failureCount, 0), RETRY_DELAYS_MS.length - 1)
  ];
}

/**
 * Client defaults for every query. Set under `defaultOptions.queries`, so the
 * loaders' `fetchQuery`/`ensureQueryData` inherit it too: query-core only
 * forces `retry: false` on those when no default is configured.
 *
 * SSR gets no retries. A loader there dispatches in-process, so a failure is
 * not a flaky network, and a retry only holds the page response open longer.
 */
export function queryRetryDefaults(isServer: boolean) {
  if (isServer) return { retry: false as const };
  return { retry: shouldRetryQuery, retryDelay: queryRetryDelay };
}
