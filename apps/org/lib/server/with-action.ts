import "server-only";

import { unstable_rethrow } from "next/navigation";
import type * as z from "zod";
import { getSession } from "@/lib/auth";
import { checkRateLimit, RATE_LIMIT_ERROR } from "@/lib/ratelimit";
import type { SessionValidationResult } from "@/lib/session";
import {
  GENERIC_ERROR,
  INVALID_INPUT_ERROR,
  PASSWORD_CHANGE_REQUIRED_ERROR,
} from "./errors";
import { logServerError } from "./log";

type Authed = Exclude<SessionValidationResult, { session: null }>;
type LimiterName = Parameters<typeof checkRateLimit>[0];

// "session" guards the session row only; "user" guards both session + org row;
// "none" admits anonymous callers (the session is still resolved for the handler).
// Both authenticated modes also refuse an account that still has its default
// password, unless the action sets `allowDefaultPassword`.
type AuthMode = "session" | "user" | "none";

type Ctx<A extends AuthMode> = A extends "user"
  ? { session: Authed["session"]; user: Authed["user"] }
  : A extends "none"
    ? { session: Authed["session"] | null; user: Authed["user"] | null }
    : { session: Authed["session"]; user: Authed["user"] | null };

type ActionError = { error: string };

type ActionConfig<S extends z.ZodType, A extends AuthMode> = {
  schema?: S;
  invalidInput?: string | ((error: z.ZodError) => string);
  auth?: A;
  authError?: string;
  /** Lets an account still on its default invite password call this action. */
  allowDefaultPassword?: boolean;
  rateLimit?: {
    name: LimiterName;
    key: (ctx: Ctx<A>) => string | Promise<string>;
  };
  onError?: (err: unknown) => ActionError | undefined;
  errorMessage?: string;
};

/**
 * Standard mutation-action scaffold: parse → session guard → rate limit →
 * handler, with the shared try/catch returning the `{ error }` shape.
 *
 * - `redirect()`/`notFound()` thrown inside the handler escape via
 *   `unstable_rethrow` — never swallowed into `{ error }`.
 * - For `auth: "none"`, the rate limit runs BEFORE the session lookup so
 *   IP-keyed anonymous limiters throttle before any DB/Redis work.
 *
 * Never wire a wrapped action to `<form action>`: React passes a FormData
 * instance, which fails the schema parse — wrapped actions are programmatic-call
 * (e.g. TanStack mutate) only.
 */
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
        // An account on its default invite password may only change it. The
        // gate is here so a new action is covered without remembering to add it.
        if (user?.mustChangePassword && !config.allowDefaultPassword) {
          return { error: PASSWORD_CHANGE_REQUIRED_ERROR };
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
      logServerError("Action error:", err);
      return { error: config.errorMessage ?? GENERIC_ERROR };
    }
  }) as Action<z.input<S>, Out>;
}
