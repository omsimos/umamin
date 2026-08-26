import { PostHog } from "posthog-node";
import type { AppEnv } from "./env";
import { formatErrorChain } from "./errors";

// Worker-side error tracking. posthog-node ships a dedicated `workerd` export
// (no Node built-ins), which is what vite resolves here.
//
// Gated on NODE_ENV: `pnpm dev:web` runs with CLOUDFLARE_ENV=staging and so
// inherits staging's POSTHOG_* vars, and local crashes are not worth a PostHog
// event. Both deployed environments set NODE_ENV=production; `.dev.vars` sets
// development. Set it to production there to exercise this path locally.

type ExceptionContext = {
  /** The acting user's id where the failing path resolved one. */
  distinctId?: string;
  properties?: Record<string, unknown>;
};

type WaitUntil = (promise: Promise<unknown>) => void;

function createClient(env: AppEnv): PostHog | null {
  if (env.NODE_ENV !== "production" || !env.POSTHOG_PROJECT_TOKEN) return null;

  return new PostHog(env.POSTHOG_PROJECT_TOKEN, {
    host: env.POSTHOG_HOST ?? "https://us.i.posthog.com",
    // No batching: an isolate can be torn down before a batch timer fires, and
    // every call below already hands its send to waitUntil.
    flushAt: 1,
    flushInterval: 0,
  });
}

/**
 * Reports a caught server error. Never throws and never rejects — every call
 * site is already inside a `catch`, so a failure here would turn a handled 500
 * into an unhandled crash.
 */
export function captureServerException(
  env: AppEnv,
  waitUntil: WaitUntil | undefined,
  error: unknown,
  context: ExceptionContext = {},
): void {
  let sending: Promise<unknown>;

  try {
    const client = createClient(env);
    if (!client) return;

    sending = client
      .captureExceptionImmediate(error, context.distinctId, {
        environment: env.POSTHOG_ENV,
        // The SDK serializes the thrown error alone; a drizzle-wrapped driver
        // failure keeps its reason in `.cause`, so send the flattened chain too
        // or the issue arrives with no message (see formatErrorChain).
        error_chain: formatErrorChain(error),
        ...context.properties,
      })
      .catch(() => {});
  } catch {
    return;
  }

  // Without an ExecutionContext the send races the isolate shutdown; still
  // better than dropping it, and the response is never blocked either way.
  if (waitUntil) waitUntil(sending);
}

// Structural rather than Hono's `Context<...>`: the action layer and the read
// layer parameterize it with different Variables maps, which are invariant, and
// Hono's own ExecutionContext type is narrower than workerd's. Only waitUntil is
// needed, so ask for exactly that.
type RequestContext = {
  env: AppEnv;
  req: { url: string; method: string };
  executionCtx: { waitUntil: WaitUntil };
};

/**
 * `captureServerException` for a Hono handler. `c.executionCtx` throws when the
 * adapter has none (the node/jsdom test runner), hence the guard.
 */
export function captureRequestException(
  c: RequestContext,
  error: unknown,
  context: ExceptionContext = {},
): void {
  let waitUntil: WaitUntil | undefined;
  try {
    const ctx = c.executionCtx;
    waitUntil = (promise) => ctx.waitUntil(promise);
  } catch {
    waitUntil = undefined;
  }

  const url = new URL(c.req.url);
  captureServerException(c.env, waitUntil, error, {
    ...context,
    properties: {
      // `$current_url` is what PostHog's issue view reads; the query string is
      // dropped because it carries cursors and lookup ids.
      $current_url: url.origin + url.pathname,
      method: c.req.method,
      ...context.properties,
    },
  });
}
