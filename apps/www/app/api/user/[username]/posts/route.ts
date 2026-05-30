import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getPublicUserProfileData, getUserPostsPage } from "@/lib/server/data";
import { formatUsername } from "@/lib/utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const { username: rawUsername } = await params;
    const username = formatUsername(rawUsername);
    const user = await getPublicUserProfileData(username);

    if (!user) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const cursor = req.nextUrl.searchParams.get("cursor");
    const { session } = await getSession();
    const result = await getUserPostsPage({
      authorId: user.id,
      cursor,
      viewerId: session?.userId,
    });

    return Response.json(result);
  } catch (error) {
    console.error("Error fetching user posts:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
