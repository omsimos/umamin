import "server-only";

import type { NextRequest } from "next/server";
import { privateJson } from "@/lib/private-json";
import { publicJson } from "@/lib/public-json";
import { checkReadRateLimit, RATE_LIMIT_ERROR } from "@/lib/ratelimit";
import { INTERNAL_SERVER_ERROR } from "./errors";

type RouteContext<P> = { params: Promise<P> };

// A handler returns plain data (wrapped into the JSON envelope) or a full
// Response for route-specific early exits (401/404 with their own bodies).
type ReadHandler<P> = (
  req: NextRequest,
  ctx: RouteContext<P>,
) => Promise<Response | object>;

/**
 * Standard scaffold for the per-viewer GET routes: IP read rate limit →
 * handler → privateJson envelope (no-store + Vary: Cookie), with the shared
 * try/catch returning the 429/500 JSON errors. `label` keeps each route's
 * existing log prefix ("Error <label>:").
 */
export function withPrivateRead<P = Record<string, never>>(
  label: string,
  handler: ReadHandler<P>,
) {
  return async (req: NextRequest, ctx: RouteContext<P>): Promise<Response> => {
    try {
      if (!(await checkReadRateLimit())) {
        return privateJson({ error: RATE_LIMIT_ERROR }, { status: 429 });
      }

      const result = await handler(req, ctx);
      return result instanceof Response ? result : privateJson(result);
    } catch (error) {
      console.error(`Error ${label}:`, error);
      return privateJson({ error: INTERNAL_SERVER_ERROR }, { status: 500 });
    }
  };
}

/**
 * Same scaffold for the CDN-cached public GET routes: success responses get
 * `publicJson(result, maxAgeSeconds, { browserMaxAgeSeconds })`; 429/500 use
 * maxAge 0 so errors are never cached. `browserMaxAgeSeconds` (default 0) sets a
 * browser TTL for non-live public data so a reload within it skips the edge
 * round trip entirely — an Edge Request saved, not just a function invocation.
 */
export function withPublicRead<P = Record<string, never>>(
  label: string,
  maxAgeSeconds: number,
  handler: ReadHandler<P>,
  browserMaxAgeSeconds = 0,
) {
  return async (req: NextRequest, ctx: RouteContext<P>): Promise<Response> => {
    try {
      if (!(await checkReadRateLimit())) {
        return publicJson({ error: RATE_LIMIT_ERROR }, 0, { status: 429 });
      }

      const result = await handler(req, ctx);
      return result instanceof Response
        ? result
        : publicJson(result, maxAgeSeconds, { browserMaxAgeSeconds });
    } catch (error) {
      console.error(`Error ${label}:`, error);
      return publicJson({ error: INTERNAL_SERVER_ERROR }, 0, { status: 500 });
    }
  };
}
