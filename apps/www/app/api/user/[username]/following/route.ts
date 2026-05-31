import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { privateJson } from "@/lib/private-json";
import { checkReadRateLimit, RATE_LIMIT_ERROR } from "@/lib/ratelimit";
import { getFollowListPage, getPublicUserProfileData } from "@/lib/server/data";
import { formatUsername } from "@/lib/utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    if (!(await checkReadRateLimit())) {
      return privateJson({ error: RATE_LIMIT_ERROR }, { status: 429 });
    }

    const username = formatUsername((await params).username);
    const cursor = req.nextUrl.searchParams.get("cursor");

    const [profile, { session }] = await Promise.all([
      username ? getPublicUserProfileData(username) : Promise.resolve(null),
      getSession(),
    ]);
    if (!profile) {
      return privateJson({ error: "User not found" }, { status: 404 });
    }

    const result = await getFollowListPage({
      userId: profile.id,
      direction: "following",
      cursor,
      viewerId: session?.userId,
    });

    return privateJson(result);
  } catch (error) {
    console.error("Error fetching following:", error);
    return privateJson({ error: "Internal server error" }, { status: 500 });
  }
}
