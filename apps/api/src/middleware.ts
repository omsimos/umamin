import type { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { getAllowedOrigins } from "./config";
import { ApiError, errorJson, mapError } from "./http";
import type { AppEnv } from "./types";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const isProduction = process.env.NODE_ENV === "production";

export function applyGlobalMiddleware(app: Hono<AppEnv>) {
  const allowedOrigins = getAllowedOrigins();

  app.use(
    "*",
    requestId({
      headerName: "X-Request-Id",
    }),
  );

  app.use(
    "*",
    secureHeaders({
      crossOriginResourcePolicy: "cross-origin",
      referrerPolicy: "strict-origin-when-cross-origin",
      strictTransportSecurity: isProduction
        ? "max-age=31536000; includeSubDomains; preload"
        : false,
    }),
  );

  app.use("*", async (c, next) => {
    await next();
    c.header(
      "Permissions-Policy",
      "accelerometer=(), autoplay=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), browsing-topics=()",
    );
  });

  if (process.env.NODE_ENV !== "test") {
    app.use("*", logger());
  }

  app.use(
    "*",
    bodyLimit({
      maxSize: 1024 * 32,
      onError: (c) =>
        errorJson(
          c,
          new ApiError(413, "BAD_REQUEST", "Request body too large"),
        ),
    }),
  );

  if (allowedOrigins.length > 0) {
    app.use(
      "*",
      cors({
        origin: allowedOrigins,
        credentials: true,
        allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allowHeaders: ["Content-Type", "X-Request-Id"],
        exposeHeaders: ["X-Request-Id"],
        maxAge: 600,
      }),
    );
  }

  app.use("*", async (c, next) => {
    const origin = c.req.header("Origin");
    if (unsafeMethods.has(c.req.method)) {
      c.header("Cache-Control", "private, no-store, max-age=0");
      c.header("Vary", "Origin, Cookie");
    }

    if (
      origin &&
      unsafeMethods.has(c.req.method) &&
      !allowedOrigins.includes(origin)
    ) {
      throw new ApiError(403, "FORBIDDEN", "Origin not allowed");
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
