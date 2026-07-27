import { hc } from "hono/client";
import type { ActionsType } from "../api/actions";

// Typed Hono RPC client over the actions contract. Base is the ORIGIN + `/api`
// (the actions app defines paths at `/actions/...` and is mounted under `/api`),
// so `apiClient.actions.createPostAction.$post()` hits `/api/actions/...`.
// Same-origin in the browser (one Worker, shared cookie → no CORS); a mobile
// app passes its own absolute base to `createApiClient`. This is the future
// mobile contract (plan "Mobile-ready adjustments") — keep the paths stable.
export function createApiClient(baseUrl = "/api", init?: RequestInit) {
  return hc<ActionsType>(baseUrl, {
    init: { credentials: "include", ...init },
  });
}

export const apiClient = createApiClient();

// Every action returns `Out` on success or `{ error }` on failure (validation /
// rate limit / auth / handler-level), WITHOUT throwing — the exact envelope the
// apps/www client already branches on. Guard/transport failures (401/403/429/
// 4xx/5xx) still carry an `{ error }` body, so one shape covers every outcome.
export type ActionResult<Out> = Out | { error: string };

/**
 * Thin imperative caller preserving the `Out | { error }` union the mutationFn
 * call sites use (they narrow with `res && "error" in res`, etc.). Kept minimal:
 * Phase 3 wires this (or `apiClient`) into the React Query mutation call sites.
 * A network failure is normalized to an `{ error }` result so callers never have
 * to try/catch just to read the union.
 */
export async function callAction<Out>(
  name: string,
  input?: unknown,
  baseUrl = "/api",
): Promise<ActionResult<Out>> {
  try {
    const res = await fetch(`${baseUrl}/actions/${name}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input ?? {}),
    });

    return (await res.json()) as ActionResult<Out>;
  } catch {
    return { error: "An error occurred" };
  }
}

// Narrowing helper mirroring apps/www's getActionError.
export function actionError(res: unknown): string | undefined {
  if (
    res &&
    typeof res === "object" &&
    "error" in res &&
    typeof (res as { error?: unknown }).error === "string"
  ) {
    return (res as { error: string }).error || undefined;
  }
  return undefined;
}
