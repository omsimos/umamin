import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getPostsPage } from "@/lib/server/data";

export async function GET(req: NextRequest) {
  try {
    const cursor = req.nextUrl.searchParams.get("cursor");
    const { session } = await getSession();

    const result = await getPostsPage({
      cursor,
      viewerId: session?.userId,
    });

    return Response.json(result);
  } catch (error) {
    console.error("Error fetching posts:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
