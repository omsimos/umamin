import type { NextRequest } from "next/server";
import { publicJson } from "@/lib/public-json";
import { checkReadRateLimit, RATE_LIMIT_ERROR } from "@/lib/ratelimit";
import { getNotesPage } from "@/lib/server/data";

const PUBLIC_CACHE_SECONDS = 120;

export async function GET(req: NextRequest) {
  try {
    if (!(await checkReadRateLimit())) {
      return publicJson({ error: RATE_LIMIT_ERROR }, 0, { status: 429 });
    }

    const cursor = req.nextUrl.searchParams.get("cursor");
    const result = await getNotesPage({ cursor });

    return publicJson(result, PUBLIC_CACHE_SECONDS);
  } catch (error) {
    console.error("Error fetching public notes:", error);
    return publicJson({ error: "Internal server error" }, 0, { status: 500 });
  }
}
