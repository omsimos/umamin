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
import {
  cookieRenewal,
  csrfOriginCheck,
  ipDenylist,
  securityHeadersMiddleware,
} from "./server-lib/middleware";
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

app.route("/api", apiApp);
app.route("/auth/google", googleAuthApp);

// TanStack Start owns everything else (SSR pages). Passing the raw Request keeps
// the streamed Response body intact through the Hono wrapper. Bindings are
// stamped for the SSR loaders' in-process API dispatch (server-lib/ssr-env.ts).
app.all("*", (c) => {
  setSsrEnv(c.env);
  return startHandler(c.req.raw);
});

const scheduled: ExportedHandlerScheduledHandler<AppEnv> = async (
  event,
  env,
  ctx,
) => {
  switch (event.cron) {
    case "0 3 * * *":
      ctx.waitUntil(cleanupSessions(env));
      break;
    case "0 4 * * *":
      ctx.waitUntil(cleanupNotifications(env));
      break;
    case "*/5 * * * *":
      ctx.waitUntil(recomputeHotFeed(env));
      break;
    default:
      console.log(`[cron] unhandled: ${event.cron}`);
  }
};

export default {
  fetch: app.fetch,
  scheduled,
};
