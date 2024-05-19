import { NextRequest, NextResponse } from "next/server";

const allowedOrigins = ["https://v2.umamin.link"];

const corsOptions = {
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  const isAllowedOrigin = allowedOrigins.includes(origin);

  const isPreflight = request.method === "OPTIONS";

  if (isPreflight) {
    const preflightHeaders = {
      ...(isAllowedOrigin && { "Access-Control-Allow-Origin": origin }),
      ...corsOptions,
    };
    if (isAllowedOrigin) {
      return NextResponse.json({}, { headers: preflightHeaders });
    } else {
      return new NextResponse(null, { status: 403, headers: preflightHeaders });
    }
  }

  if (!isAllowedOrigin) {
    return new NextResponse(null, { status: 403 });
  }

  const response = NextResponse.next();

  response.headers.set("Access-Control-Allow-Origin", origin);
  Object.entries(corsOptions).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
