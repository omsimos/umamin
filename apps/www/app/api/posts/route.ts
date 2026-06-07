import { getSession } from "@/lib/auth";
import { normalizeFeedSort } from "@/lib/feed-sort";
import { privateJson } from "@/lib/private-json";
import { getPostsPage } from "@/lib/server/data";
import { withPrivateRead } from "@/lib/server/read-route";

export const GET = withPrivateRead("fetching posts", async (req) => {
  const cursor = req.nextUrl.searchParams.get("cursor");
  const sort = normalizeFeedSort(req.nextUrl.searchParams.get("sort"));
  const { session } = await getSession();

  if (sort === "following" && !session) {
    return privateJson({ error: "Unauthorized" }, { status: 401 });
  }

  return getPostsPage({
    cursor,
    sort,
    viewerId: session?.userId,
  });
});
