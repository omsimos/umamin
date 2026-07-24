import type { AppEnv } from "./env";

// Bindings holder for SSR loader dispatch (lib/loader-fetch.ts). The outer
// Hono entry stamps `env` before delegating to the Start handler, so loaders
// can reach bindings through a plain module import instead of the
// `cloudflare:workers` virtual module — which only resolves inside workerd and
// breaks the browser's dev-time import analysis. Safe as module state: every
// request in a Worker isolate shares the same env object.
let currentEnv: AppEnv | undefined;

export function setSsrEnv(env: AppEnv): void {
  currentEnv = env;
}

export function getSsrEnv(): AppEnv {
  if (!currentEnv) {
    throw new Error("SSR env not set — server entry must call setSsrEnv");
  }
  return currentEnv;
}
