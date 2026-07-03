import "server-only";

import type { NextRequest } from "next/server";
import { privateJson } from "@/lib/private-json";
import { checkReadRateLimit, RATE_LIMIT_ERROR } from "@/lib/ratelimit";
import { INTERNAL_SERVER_ERROR } from "./errors";

type RouteContext<P> = { params: Promise<P> };

type ReadHandler<P> = (
  req: NextRequest,
  ctx: RouteContext<P>,
) => Promise<Response | object>;

/**
 * Per-viewer GET routes: IP read rate limit → handler → privateJson envelope
 * (no-store + Vary: Cookie), with the shared try/catch for 429/500.
 * (All org GET routes are per-viewer; a CDN-cached variant can be ported back
 * from apps/www's withPublicRead if a public JSON surface ever appears.)
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
