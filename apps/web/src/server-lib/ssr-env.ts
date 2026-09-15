import { AsyncLocalStorage } from "node:async_hooks";
import type { AppEnv } from "./env";

// Bindings holder for SSR loader dispatch (lib/loader-fetch.ts). The outer
// Hono entry stamps `env` before delegating to the Start handler, so loaders
// can reach bindings through a plain module import instead of the
// `cloudflare:workers` virtual module — which only resolves inside workerd and
// breaks the browser's dev-time import analysis. Safe as module state: every
// request in a Worker isolate shares the same env object.
let currentEnv: AppEnv | undefined;

// Structural for the same reason server-lib/posthog.ts is: Hono's
// ExecutionContext is narrower than workerd's, and only waitUntil is needed.
export type SsrExecutionContext = {
  waitUntil: (promise: Promise<unknown>) => void;
};

// Unlike env, the execution context is PER REQUEST, and one isolate serves
// many requests at once — a module variable would hand request A's loader
// background work to whichever request set it last, and workerd refuses I/O on
// behalf of a foreign request. AsyncLocalStorage follows the request's own
// async continuation (loaders included) instead.
const ctxStorage = new AsyncLocalStorage<SsrExecutionContext>();

export function setSsrEnv(env: AppEnv): void {
  currentEnv = env;
}

export function runWithSsrContext<T>(
  ctx: SsrExecutionContext | undefined,
  fn: () => T,
): T {
  return ctx ? ctxStorage.run(ctx, fn) : fn();
}

export function getSsrEnv(): AppEnv {
  if (!currentEnv) {
    throw new Error("SSR env not set — server entry must call setSsrEnv");
  }
  return currentEnv;
}

// The dispatched read's background work (error reports, cache puts) is
// cancelled with the isolate unless it is handed to a REAL waitUntil.
export function getSsrExecutionContext(): SsrExecutionContext | undefined {
  return ctxStorage.getStore();
}
