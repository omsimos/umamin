import { DEFAULT_FEED_SORT, normalizeFeedSort } from "@/lib/feed-sort";
import { getPostsPage } from "@/lib/server/data";
import { withPublicRead } from "@/lib/server/read-route";

export const GET = withPublicRead("fetching public posts", 120, async (req) => {
  const cursor = req.nextUrl.searchParams.get("cursor");
  const requestedSort = normalizeFeedSort(req.nextUrl.searchParams.get("sort"));
  const sort =
    requestedSort === "following" ? DEFAULT_FEED_SORT : requestedSort;
  return getPostsPage({ cursor, sort });
});
