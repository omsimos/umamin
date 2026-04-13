import type { NextRequest } from "next/server";
import { publicJson } from "@/lib/public-json";
import { getPostCommentsPage } from "@/lib/server/data";

const PUBLIC_CACHE_SECONDS = 120;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const postId = (await params).id;
    const cursor = req.nextUrl.searchParams.get("cursor");
    const result = await getPostCommentsPage({ postId, cursor });

    return publicJson(result, PUBLIC_CACHE_SECONDS);
  } catch (error) {
    console.error("Error fetching public comments:", error);
    return publicJson({ error: "Internal server error" }, 0, { status: 500 });
  }
}
