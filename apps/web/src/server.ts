import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";
import { Hono } from "hono";
import { apiApp } from "./api";
import { googleAuthApp } from "./api/auth";
import {
  cleanupNotifications,
  cleanupSessions,
  recomputeHotFeed,
} from "./server-lib/cron";
import type { AppEnv } from "./server-lib/env";
import { formatErrorChain } from "./server-lib/errors";
import {
  cookieRenewal,
  csrfOriginCheck,
  ipDenylist,
  securityHeadersMiddleware,
} from "./server-lib/middleware";
import {
  captureRequestException,
  captureServerException,
} from "./server-lib/posthog";
import { setSsrEnv } from "./server-lib/ssr-env";

// TanStack Start SSR handler. `createStartHandler` returns a universal
// (request) => Response fetch function; the outer Hono app owns middleware/cron
// and delegates page routes to it.
const startHandler = createStartHandler(defaultStreamHandler);

const app = new Hono<{ Bindings: AppEnv }>();

// Global chain (order matters): denylist front-door → CSRF origin guard for
// cookie-authed page mutations → security headers (stream-safe, headers only) →
// sliding session-cookie renewal on GET page routes.
app.use("*", ipDenylist());
app.use("*", csrfOriginCheck());
app.use("*", securityHeadersMiddleware());
app.use("*", cookieRenewal());

// Anything that escapes a handler uncaught: SSR render failures, the OAuth
// callback, webhooks. The action()/withPrivateRead/withPublicRead wrappers catch
// their own errors and report there, so this is the surface they do not cover.
// The response mirrors Hono's own errorHandler, including the HTTPException
// passthrough — an HTTPException is a deliberate status, not a bug, so it is
// answered without being reported.
app.onError((err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error("Unhandled error:", formatErrorChain(err));
  captureRequestException(c, err);
  return c.text("Internal Server Error", 500);
});

app.route("/api", apiApp);
app.route("/auth/google", googleAuthApp);

// An unmatched /api path would otherwise fall through to the SSR catch-all below
// and answer an API call with a rendered HTML 404 page.
app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

// TanStack Start owns everything else (SSR pages). Passing the raw Request keeps
// the streamed Response body intact through the Hono wrapper. Bindings are
// stamped for the SSR loaders' in-process API dispatch (server-lib/ssr-env.ts).
app.all("*", (c) => {
  setSsrEnv(c.env);
  return startHandler(c.req.raw);
});

// A cron has no client to surface a failure to, so a rejected job is otherwise
// only visible in Workers logs. `report` wraps each job rather than the switch:
// the work runs inside waitUntil, so a throw lands on the returned promise.
const scheduled: ExportedHandlerScheduledHandler<AppEnv> = async (
  event,
  env,
  ctx,
) => {
  const report = (job: Promise<unknown>) =>
    job.catch((error: unknown) => {
      console.error(`[cron] ${event.cron} failed:`, formatErrorChain(error));
      captureServerException(env, (p) => ctx.waitUntil(p), error, {
        properties: { cron: event.cron },
      });
    });

  switch (event.cron) {
    case "0 3 * * *":
      ctx.waitUntil(report(cleanupSessions(env)));
      break;
    case "0 4 * * *":
      ctx.waitUntil(report(cleanupNotifications(env)));
      break;
    case "*/5 * * * *":
      ctx.waitUntil(report(recomputeHotFeed(env)));
      break;
    default:
      console.log(`[cron] unhandled: ${event.cron}`);
  }
};

export default {
  fetch: app.fetch,
  scheduled,
};
