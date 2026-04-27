import type { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { nanoid } from "nanoid";
import { getAllowedOrigins } from "./config";
import { ApiError, errorJson, mapError } from "./http";
import type { AppEnv } from "./types";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function applyGlobalMiddleware(app: Hono<AppEnv>) {
  const allowedOrigins = getAllowedOrigins();

  app.use("*", async (c, next) => {
    c.set("requestId", c.req.header("x-request-id") ?? nanoid(10));
    c.header("X-Request-Id", c.get("requestId"));
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header(
      "Permissions-Policy",
      "accelerometer=(), autoplay=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), browsing-topics=()",
    );
    if (process.env.NODE_ENV === "production") {
      c.header(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains; preload",
      );
    }
    await next();
  });

  app.use("*", logger());
  app.use("*", bodyLimit({ maxSize: 1024 * 32 }));

  if (allowedOrigins.length > 0) {
    app.use(
      "*",
      cors({
        origin: allowedOrigins,
        credentials: true,
      }),
    );
  }

  app.use("*", async (c, next) => {
    const origin = c.req.header("Origin");
    if (
      origin &&
      unsafeMethods.has(c.req.method) &&
      !allowedOrigins.includes(origin)
    ) {
      throw new ApiError(403, "FORBIDDEN", "Origin not allowed");
    }

    if (unsafeMethods.has(c.req.method)) {
      c.header("Cache-Control", "private, no-store, max-age=0");
      c.header("Vary", "Origin, Cookie");
    }

    await next();
  });

  app.onError((err, c) => {
    const mapped = mapError(err);
    if (mapped.status >= 500) {
      console.error("Unhandled API error", {
        requestId: c.get("requestId"),
        path: c.req.path,
        err,
      });
    }
    return errorJson(c, mapped);
  });

  app.notFound((c) =>
    errorJson(c, new ApiError(404, "NOT_FOUND", "Not found")),
  );
}
