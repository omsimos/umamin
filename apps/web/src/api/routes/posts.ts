import { Hono } from "hono";
import { normalizeFeedSort } from "../../lib/feed-sort";
import type { AppBindings } from "../../server-lib/context";
import {
  getPostById,
  getPostCommentsPage,
  getPostsPage,
} from "../../server-lib/data";
import { UNAUTHORIZED_ERROR } from "../../server-lib/errors";
import { withPrivateRead } from "../../server-lib/read-route";
import { getSessionFrom, resolveDb } from "./_shared";

// Private (per-viewer) post reads. `following` requires a session; anonymous
// feed reads live behind /public/posts.
export const postsRoutes = new Hono<AppBindings>()
  .get(
    "/posts",
    withPrivateRead("fetching posts", async (c) => {
      const cursor = c.req.query("cursor") ?? null;
      const sort = normalizeFeedSort(c.req.query("sort"));
      const { session } = await getSessionFrom(c);

      if (sort === "following" && !session) {
        return Response.json({ error: UNAUTHORIZED_ERROR }, { status: 401 });
      }

      return getPostsPage(resolveDb(c.env), c.env.KV, {
        cursor,
        sort,
        viewerId: session?.userId,
      });
    }),
  )
  .get(
    "/posts/:id",
    withPrivateRead("fetching post", async (c) => {
      const { session } = await getSessionFrom(c);
      const result = await getPostById(resolveDb(c.env), {
        postId: c.req.param("id") ?? "",
        viewerId: session?.userId,
      });
      return result ?? null;
    }),
  )
  .get(
    "/posts/:id/comments",
    withPrivateRead("fetching comments", async (c) => {
      const { session } = await getSessionFrom(c);
      return getPostCommentsPage(resolveDb(c.env), {
        postId: c.req.param("id") ?? "",
        cursor: c.req.query("cursor") ?? null,
        viewerId: session?.userId,
      });
    }),
  );
