import { captureException } from "./posthog";

// Every action returns `Out` on success or `{ error }` on failure (validation /
// rate limit / auth / handler-level), WITHOUT throwing — the exact envelope the
// apps/www client already branches on. Guard/transport failures (401/403/429/
// 4xx/5xx) still carry an `{ error }` body, so one shape covers every outcome.
export type ActionResult<Out> = Out | { error: string };

/**
 * Thin imperative caller preserving the `Out | { error }` union the mutationFn
 * call sites use (they narrow with `res && "error" in res`, etc.). A network
 * failure is normalized to an `{ error }` result so callers never have to
 * try/catch just to read the union.
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
  } catch (err) {
    // AbortError (unmount/cancel) and being offline are expected outcomes, not
    // bugs — everything else here is a transport failure the server never saw.
    const expected =
      (err instanceof DOMException && err.name === "AbortError") ||
      (typeof navigator !== "undefined" && navigator.onLine === false);
    if (!expected) {
      captureException(err, { source: "callAction", action: name });
    }
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
