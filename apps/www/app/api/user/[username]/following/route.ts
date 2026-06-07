import { getSession } from "@/lib/auth";
import { privateJson } from "@/lib/private-json";
import { getFollowListPage, getPublicUserProfileData } from "@/lib/server/data";
import { withPrivateRead } from "@/lib/server/read-route";
import { formatUsername } from "@/lib/utils";

export const GET = withPrivateRead<{ username: string }>(
  "fetching following",
  async (req, { params }) => {
    const username = formatUsername((await params).username);
    const cursor = req.nextUrl.searchParams.get("cursor");

    const [profile, { session }] = await Promise.all([
      username ? getPublicUserProfileData(username) : Promise.resolve(null),
      getSession(),
    ]);
    if (!profile) {
      return privateJson({ error: "User not found" }, { status: 404 });
    }

    return getFollowListPage({
      userId: profile.id,
      direction: "following",
      cursor,
      viewerId: session?.userId,
    });
  },
);
