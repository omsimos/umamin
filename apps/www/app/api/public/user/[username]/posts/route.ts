import type { NextRequest } from "next/server";
import { publicJson } from "@/lib/public-json";
import { getPublicUserProfileData, getUserPostsPage } from "@/lib/server/data";
import { formatUsername } from "@/lib/utils";

const PUBLIC_CACHE_SECONDS = 120;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const { username: rawUsername } = await params;
    const username = formatUsername(rawUsername);
    const user = await getPublicUserProfileData(username);

    if (!user) {
      return publicJson({ error: "Not found" }, 0, { status: 404 });
    }

    const cursor = req.nextUrl.searchParams.get("cursor");
    const result = await getUserPostsPage({ authorId: user.id, cursor });

    return publicJson(result, PUBLIC_CACHE_SECONDS);
  } catch (error) {
    console.error("Error fetching public user posts:", error);
    return publicJson({ error: "Internal server error" }, 0, { status: 500 });
  }
}
