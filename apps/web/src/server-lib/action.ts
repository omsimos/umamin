import type { SelectSession, SelectUser } from "@umamin/db/schema/user";
import type { Context } from "hono";
import type * as z from "zod";
import type { AppBindings } from "./context";
import { passesCsrf } from "./csrf";
import { GENERIC_ERROR, INVALID_INPUT_ERROR } from "./errors";
import { captureRequestException } from "./posthog";
import {
  checkRateLimit,
  type LimiterName,
  RATE_LIMIT_ERROR,
} from "./ratelimit";

// Hono port of apps/www/lib/server/with-action.ts with the IDENTICAL config
// surface (schema / invalidInput / auth / authError / rateLimit{name,key} /
// onError / errorMessage) and the same `{ error } | Out` envelope, so client
// call sites + action tests port near-verbatim. Differences from Next:
//  - input comes from the JSON request body (not a single function argument);
//  - `redirect()` isn't thrown — redirect-shaped flows (login/signup) stay
//    unwrapped, exactly as they were in apps/www;
//  - CSRF: cookie/anonymous non-GET must pass Origin===Host; bearer bypasses
//    (mobile). Guard failures use meaningful HTTP status but always an
//    `{ error }` body, so a typed hc<AppType> client reads one shape.

type AppContext = Context<AppBindings>;

// "session" guards the session row only; "user" guards both; "none" admits
// anonymous callers (the session is still resolved for the handler).
type AuthMode = "session" | "user" | "none";

type Ctx<A extends AuthMode> = (A extends "user"
  ? { session: SelectSession; user: SelectUser }
  : A extends "none"
    ? { session: SelectSession | null; user: SelectUser | null }
    : { session: SelectSession; user: SelectUser | null }) & {
  c: AppContext;
};

type ActionError = { error: string };

type ActionConfig<S extends z.ZodType, A extends AuthMode> = {
  /** Parses the JSON body; failure returns `invalidInput`. */
  schema?: S;
  /** Parse-failure message, or a mapper over the ZodError (default "Invalid input"). */
  invalidInput?: string | ((error: z.ZodError) => string);
  auth?: A;
  /** Auth-guard failure message (default the generic error). */
  authError?: string;
  rateLimit?: {
    name: LimiterName;
    key: (ctx: Ctx<A>) => string | Promise<string>;
  };
  /** Map a caught error to a specific result (e.g. unique-constraint →
   * "Username already exists"); return undefined to fall through. */
  onError?: (err: unknown) => ActionError | undefined;
  /** Catch-all failure message (default the generic error). */
  errorMessage?: string;
};

export function action<
  Out,
  S extends z.ZodType = z.ZodType<undefined>,
  A extends AuthMode = "session",
>(
  config: ActionConfig<S, A>,
  handler: (input: z.output<S>, ctx: Ctx<A>) => Promise<Out>,
): (c: AppContext) => Promise<Response> {
  return async (c: AppContext) => {
    // Transport-level CSRF first: reject a cross-origin cookie/anonymous
    // mutation before doing any parsing or DB work. Bearer requests bypass.
    if (!passesCsrf(c)) {
      return c.json({ error: GENERIC_ERROR }, 403);
    }

    // Hoisted so the catch below can attribute the failure to a user; `ctx` is
    // scoped to the try and the session resolver is not re-run on the error path.
    let actorId: string | undefined;

    try {
      let input = undefined as z.output<S>;

      if (config.schema) {
        let raw: unknown;
        try {
          raw = await c.req.json();
        } catch {
          raw = undefined;
        }
        const parsed = config.schema.safeParse(raw);
        if (!parsed.success) {
          const error =
            typeof config.invalidInput === "function"
              ? config.invalidInput(parsed.error)
              : (config.invalidInput ?? INVALID_INPUT_ERROR);
          return c.json({ error }, 400);
        }
        input = parsed.data as z.output<S>;
      }

      const auth = (config.auth ?? "session") as AuthMode;
      let ctx: Ctx<A>;

      if (auth === "none") {
        // Rate-limit BEFORE the session lookup so IP-keyed anonymous limiters
        // throttle before any DB work.
        if (config.rateLimit) {
          const key = await config.rateLimit.key({
            session: null,
            user: null,
            c,
          } as unknown as Ctx<A>);
          if (!(await checkRateLimit(c.env, config.rateLimit.name, key))) {
            return c.json({ error: RATE_LIMIT_ERROR }, 429);
          }
        }
        const { session, user } = await c.var.getSession();
        actorId = session?.userId;
        ctx = { session, user, c } as unknown as Ctx<A>;
      } else {
        const { session, user } = await c.var.getSession();
        if (!session || (auth === "user" && !user)) {
          return c.json({ error: config.authError ?? GENERIC_ERROR }, 401);
        }
        actorId = session.userId;
        ctx = { session, user, c } as unknown as Ctx<A>;
        if (config.rateLimit) {
          const key = await config.rateLimit.key(ctx);
          if (!(await checkRateLimit(c.env, config.rateLimit.name, key))) {
            return c.json({ error: RATE_LIMIT_ERROR }, 429);
          }
        }
      }

      const result = await handler(input, ctx);
      return c.json(result as object);
    } catch (err) {
      const mapped = config.onError?.(err);
      if (mapped) {
        return c.json(mapped, 400);
      }
      console.log(err);
      // Only the unmapped path reports: an `onError` match is an expected
      // outcome (a unique-constraint hit), not a bug to triage.
      captureRequestException(c, err, { distinctId: actorId });
      return c.json({ error: config.errorMessage ?? GENERIC_ERROR }, 500);
    }
  };
}
