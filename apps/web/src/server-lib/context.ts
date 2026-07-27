import type { MiddlewareHandler } from "hono";
import { type Db, getDb } from "./db";
import type { AppEnv } from "./env";
import { type ResolvedSession, resolveSession } from "./session";

// Per-request context shared by the action/read layers. `getSession` is a lazy,
// memoized resolver so `auth:"none"` actions can rate-limit BEFORE any session
// lookup (plan requirement) and a request that never needs the viewer pays no
// DB read. Tests replace it with a stub resolver — that's why the action factory
// reads it off the context instead of importing resolveSession directly.
//
// `db` is an OPTIONAL injection seam (Phase 2c): production never sets it, so
// action handlers fall back to getDb(c.env); the in-memory-libSQL test harness
// sets it to a `() => testDb` so the same handlers run against real SQL. Kept
// off the hot path — a request that touches no DB never builds a client.
export type AppVariables = {
  getSession: () => Promise<ResolvedSession>;
  db?: () => Db;
};

export type AppBindings = { Bindings: AppEnv; Variables: AppVariables };

export function sessionContext(): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    let cached: Promise<ResolvedSession> | undefined;
    c.set("getSession", () => {
      cached ??= resolveSession(c, getDb(c.env));
      return cached;
    });
    await next();
  };
}
