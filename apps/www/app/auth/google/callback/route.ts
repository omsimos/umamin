import type { NextRequest } from "next/server";

export function GET(req: NextRequest) {
  const apiOrigin = process.env.HONO_API_ORIGIN ?? process.env.API_ORIGIN;
  const target = apiOrigin
    ? `${apiOrigin}/auth/google/callback${req.nextUrl.search}`
    : `/auth/google/callback${req.nextUrl.search}`;

  return Response.redirect(target, 302);
}
