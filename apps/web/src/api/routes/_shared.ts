import type { Context, MiddlewareHandler } from "hono";
import type { AppBindings } from "../../server-lib/context";
import { type Db, getDb } from "../../server-lib/db";
import type { AppEnv } from "../../server-lib/env";
import { type ResolvedSession, resolveSession } from "../../server-lib/session";

// ── DB seam ──────────────────────────────────────────────────────────────────
// Read handlers resolve the Turso client through this indirection instead of
// importing getDb directly, so tests can swap in the in-memory libSQL helper
// (test/helpers/db.ts) — the same injection seam the Phase 1 session/action
// suites use. In production `resolveDb === getDb`.
let dbOverride: ((env: AppEnv) => Db) | null = null;

export function resolveDb(env: AppEnv): Db {
  return (dbOverride ?? getDb)(env);
}

// Test-only: override (or clear with null) the db factory the read routes use.
export function __setReadDb(factory: ((env: AppEnv) => Db) | null): void {
  dbOverride = factory;
}

// ── Session ──────────────────────────────────────────────────────────────────
// Mirrors server-lib/context.sessionContext but resolves the db through the
// seam above so a test db flows into both session validation and data reads.
// Mounted once on readsApp; the memoized resolver is shared by every handler.
export function readsSessionContext(): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    let cached: Promise<ResolvedSession> | undefined;
    c.set("getSession", () => {
      cached ??= resolveSession(c, resolveDb(c.env));
      return cached;
    });
    await next();
  };
}

// read-route types its handler context with bindings only (no Variables), so
// reach the memoized resolver through a narrow cast at the call sites.
export function getSessionFrom(c: Context): Promise<ResolvedSession> {
  return (c as Context<AppBindings>).var.getSession();
}

// ── URL helpers ────────────────────────────────────────────────────────────
// Ported verbatim from apps/www/lib/utils.formatUsername: the profile routes
// accept a `%40`-prefixed (URL-encoded `@`) username segment.
export function formatUsername(username: string): string {
  const formatted = username.startsWith("%40")
    ? username.split("%40").at(1)
    : username;
  return formatted ?? "";
}
