import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { privateJson } from "@/lib/private-json";
import { checkReadRateLimit, RATE_LIMIT_ERROR } from "@/lib/ratelimit";
import { getPostCommentsPage } from "@/lib/server/data";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await checkReadRateLimit())) {
      return privateJson({ error: RATE_LIMIT_ERROR }, { status: 429 });
    }

    const postId = (await params).id;
    const cursor = req.nextUrl.searchParams.get("cursor");
    const { session } = await getSession();

    const result = await getPostCommentsPage({
      postId,
      cursor,
      viewerId: session?.userId,
    });

    return privateJson(result);
  } catch (error) {
    console.error("Error fetching comments:", error);
    return privateJson({ error: "Internal server error" }, { status: 500 });
  }
}
