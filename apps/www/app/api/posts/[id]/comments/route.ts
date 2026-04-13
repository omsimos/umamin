import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getPostCommentsPage } from "@/lib/server/data";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const postId = (await params).id;
    const cursor = req.nextUrl.searchParams.get("cursor");
    const { session } = await getSession();

    const result = await getPostCommentsPage({
      postId,
      cursor,
      viewerId: session?.userId,
    });

    return Response.json(result);
  } catch (error) {
    console.error("Error fetching comments:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
