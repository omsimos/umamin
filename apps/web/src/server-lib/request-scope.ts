import { AsyncLocalStorage } from "node:async_hooks";

// Collapses identical lookups (session, flags, IP denylist) within ONE
// request, such as the SSR loaders a page dispatches in parallel. Never across
// requests: workerd ties a promise's I/O to the request that started it and
// drops it when that request ends, so a second request waiting on the same
// promise could never settle ("This promise was created by a request that has
// since ended"). Across requests, only settled values are shared, through each
// module's own cache.
//
// AsyncLocalStorage follows the request's async continuation, including the
// in-process SSR dispatch in lib/loader-fetch.ts. Outside a scope (tests,
// crons) every call runs its own lookup.
const scope = new AsyncLocalStorage<Map<string, Promise<unknown>>>();

export function runInRequestScope<T>(fn: () => T): T {
  return scope.run(new Map(), fn);
}

export function shareWithinRequest<T>(
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  const pending = scope.getStore();
  if (!pending) return load();

  const existing = pending.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const lookup = load();
  pending.set(key, lookup);
  const forget = () => {
    // A forgetWithinRequest() may have replaced the entry meanwhile.
    if (pending.get(key) === lookup) pending.delete(key);
  };
  lookup.then(forget, forget);
  return lookup;
}

// Drops this request's pending lookups whose key starts with `prefix`, so a
// call made after an invalidation can't join a lookup that predates it.
export function forgetWithinRequest(prefix: string): void {
  const pending = scope.getStore();
  if (!pending) return;
  for (const key of pending.keys()) {
    if (key.startsWith(prefix)) pending.delete(key);
  }
}
