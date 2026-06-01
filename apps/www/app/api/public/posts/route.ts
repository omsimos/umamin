import type { NextRequest } from "next/server";
import { DEFAULT_FEED_SORT, normalizeFeedSort } from "@/lib/feed-sort";
import { publicJson } from "@/lib/public-json";
import { checkReadRateLimit, RATE_LIMIT_ERROR } from "@/lib/ratelimit";
import { getPostsPage } from "@/lib/server/data";

const PUBLIC_CACHE_SECONDS = 120;

export async function GET(req: NextRequest) {
  try {
    if (!(await checkReadRateLimit())) {
      return publicJson({ error: RATE_LIMIT_ERROR }, 0, { status: 429 });
    }

    const cursor = req.nextUrl.searchParams.get("cursor");
    const requestedSort = normalizeFeedSort(
      req.nextUrl.searchParams.get("sort"),
    );
    const sort =
      requestedSort === "following" ? DEFAULT_FEED_SORT : requestedSort;
    const result = await getPostsPage({ cursor, sort });

    return publicJson(result, PUBLIC_CACHE_SECONDS);
  } catch (error) {
    console.error("Error fetching public posts:", error);
    return publicJson({ error: "Internal server error" }, 0, { status: 500 });
  }
}
