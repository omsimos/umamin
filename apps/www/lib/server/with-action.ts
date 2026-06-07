import "server-only";

import { unstable_rethrow } from "next/navigation";
import type * as z from "zod";
import { getSession } from "@/lib/auth";
import { checkRateLimit, RATE_LIMIT_ERROR } from "@/lib/ratelimit";
import type { SessionValidationResult } from "@/lib/session";
import { GENERIC_ERROR, INVALID_INPUT_ERROR } from "./errors";

type Authed = Exclude<SessionValidationResult, { session: null }>;
type LimiterName = Parameters<typeof checkRateLimit>[0];

// "session" guards the session row only (some callers run with a session but
// no hydrated user, e.g. test fixtures); "user" guards both; "none" admits
// anonymous callers (the session is still resolved for the handler).
type AuthMode = "session" | "user" | "none";

type Ctx<A extends AuthMode> = A extends "user"
  ? { session: Authed["session"]; user: Authed["user"] }
  : A extends "none"
    ? { session: Authed["session"] | null; user: Authed["user"] | null }
    : { session: Authed["session"]; user: Authed["user"] | null };

type ActionError = { error: string };

type ActionConfig<S extends z.ZodType, A extends AuthMode> = {
  /** Parses the action's single argument; failure returns `invalidInput`. */
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

/**
 * Standard mutation-action scaffold: parse → session guard → rate limit →
 * handler, with the shared try/catch returning the `{ error }` shape every
 * caller already branches on.
 *
 * Order notes:
 * - `redirect()`/`notFound()` thrown inside the handler escape via
 *   `unstable_rethrow` — never swallowed into `{ error }`.
 * - For `auth: "none"`, the rate limit runs BEFORE the session lookup so
 *   IP-keyed anonymous limiters throttle before any DB/Redis work.
 *
 * Stays outside the wrapper by design: `login`/`signup`/`logout` and
 * `deleteAccountAction` (FormData/redirect-shaped flows). Never wire a
 * wrapped action to `<form action>`: React passes a FormData instance,
 * which fails the schema parse — wrapped actions are programmatic-call
 * (e.g. TanStack mutate) only.
 */
// The argument stays required for schemas with a required input (so callers
// and TanStack variable inference keep their contracts) and becomes optional
// only when the schema admits undefined — or when there is no schema at all
// (zero-arg actions like unpin).
type Action<In, Out> = undefined extends In
  ? (values?: In) => Promise<Out | ActionError>
  : (values: In) => Promise<Out | ActionError>;

export function withAction<
  Out,
  S extends z.ZodType = z.ZodType<void, void>,
  A extends AuthMode = "session",
>(
  config: ActionConfig<S, A>,
  handler: (input: z.output<S>, ctx: Ctx<A>) => Promise<Out>,
): Action<z.input<S>, Out> {
  return (async (values?: z.input<S>) => {
    try {
      let input = values as z.output<S>;

      if (config.schema) {
        const parsed = config.schema.safeParse(values);
        if (!parsed.success) {
          return {
            error:
              typeof config.invalidInput === "function"
                ? config.invalidInput(parsed.error)
                : (config.invalidInput ?? INVALID_INPUT_ERROR),
          };
        }
        input = parsed.data as z.output<S>;
      }

      const auth = config.auth ?? "session";
      let ctx: Ctx<A>;

      if (auth === "none") {
        if (config.rateLimit) {
          const key = await config.rateLimit.key({
            session: null,
            user: null,
          } as Ctx<A>);
          if (!(await checkRateLimit(config.rateLimit.name, key))) {
            return { error: RATE_LIMIT_ERROR };
          }
        }
        const { session, user } = await getSession();
        ctx = { session, user } as Ctx<A>;
      } else {
        const { session, user } = await getSession();
        if (!session || (auth === "user" && !user)) {
          return { error: config.authError ?? GENERIC_ERROR };
        }
        ctx = { session, user } as Ctx<A>;
        if (config.rateLimit) {
          const key = await config.rateLimit.key(ctx);
          if (!(await checkRateLimit(config.rateLimit.name, key))) {
            return { error: RATE_LIMIT_ERROR };
          }
        }
      }

      return await handler(input, ctx);
    } catch (err) {
      unstable_rethrow(err);
      const mapped = config.onError?.(err);
      if (mapped) {
        return mapped;
      }
      console.log(err);
      return { error: config.errorMessage ?? GENERIC_ERROR };
    }
  }) as Action<z.input<S>, Out>;
}
