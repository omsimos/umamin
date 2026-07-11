import { publicJson } from "@/lib/public-json";
import { getPublicUserProfileData, getUserPostsPage } from "@/lib/server/data";
import { withPublicRead } from "@/lib/server/read-route";
import { formatUsername } from "@/lib/utils";

export const GET = withPublicRead<{ username: string }>(
  "fetching public user posts",
  120,
  async (req, { params }) => {
    const { username: rawUsername } = await params;
    const username = formatUsername(rawUsername);
    const user = await getPublicUserProfileData(username);

    if (!user) {
      return publicJson({ error: "Not found" }, 0, { status: 404 });
    }

    const cursor = req.nextUrl.searchParams.get("cursor");
    return getUserPostsPage({ authorId: user.id, cursor });
  },
  60,
);
