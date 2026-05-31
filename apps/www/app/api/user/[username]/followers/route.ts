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

    // Resolve username -> id via the already-cached profile read (no extra DB
    // cost) so the cache key / list query keys on the stable user id. The
    // profile read and the session read are independent — run them together.
    const [profile, { session }] = await Promise.all([
      username ? getPublicUserProfileData(username) : Promise.resolve(null),
      getSession(),
    ]);
    if (!profile) {
      return privateJson({ error: "User not found" }, { status: 404 });
    }

    const result = await getFollowListPage({
      userId: profile.id,
      direction: "followers",
      cursor,
      viewerId: session?.userId,
    });

    return privateJson(result);
  } catch (error) {
    console.error("Error fetching followers:", error);
    return privateJson({ error: "Internal server error" }, { status: 500 });
  }
}
