import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { normalizeFeedSort } from "@/lib/feed-sort";
import { privateJson } from "@/lib/private-json";
import { checkReadRateLimit, RATE_LIMIT_ERROR } from "@/lib/ratelimit";
import { getPostsPage } from "@/lib/server/data";

export async function GET(req: NextRequest) {
  try {
    if (!(await checkReadRateLimit())) {
      return privateJson({ error: RATE_LIMIT_ERROR }, { status: 429 });
    }

    const cursor = req.nextUrl.searchParams.get("cursor");
    const sort = normalizeFeedSort(req.nextUrl.searchParams.get("sort"));
    const { session } = await getSession();

    if (sort === "following" && !session) {
      return privateJson({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await getPostsPage({
      cursor,
      sort,
      viewerId: session?.userId,
    });

    return privateJson(result);
  } catch (error) {
    console.error("Error fetching posts:", error);
    return privateJson({ error: "Internal server error" }, { status: 500 });
  }
}
