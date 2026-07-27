import type { Context } from "hono";
import type { AppBindings } from "../../server-lib/context";
import { type Db, getDb } from "../../server-lib/db";

export type AppContext = Context<AppBindings>;

// DB access with the test-injection seam (context.ts `db` var). Production never
// sets the var → falls back to a per-request client from the binding env.
export function ctxDb(c: AppContext): Db {
  return c.var.db ? c.var.db() : getDb(c.env);
}

// Off-critical-path scheduler for notify()'s push fan-out — the Worker's
// ctx.waitUntil. In a test harness (no execution context) it lets the promise
// float; the push fan-out no-ops without VAPID config, so nothing is lost.
export function defer(c: AppContext) {
  return (p: Promise<unknown>) => {
    try {
      c.executionCtx.waitUntil(p);
    } catch {
      void p;
    }
  };
}
