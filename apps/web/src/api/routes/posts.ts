import { Hono } from "hono";
import { normalizeFeedSort } from "../../lib/feed-sort";
import type {
  CommentsResponse,
  FeedResponse,
  PostResponse,
} from "../../lib/types";
import type { AppBindings } from "../../server-lib/context";
import {
  getPostById,
  getPostCommentsPage,
  getPostsPage,
} from "../../server-lib/data";
import { UNAUTHORIZED_ERROR } from "../../server-lib/errors";
import {
  getCachedPublicPayload,
  withPrivateRead,
} from "../../server-lib/read-route";
import { getSessionFrom, resolveDb } from "./_shared";
import {
  PUBLIC_BROWSER_MAX_AGE,
  PUBLIC_COMMENTS_MAX_AGE,
  PUBLIC_POST_MAX_AGE,
  PUBLIC_POSTS_MAX_AGE,
} from "./public";

// Private (per-viewer) post reads. `following` requires a session; anonymous
// feed reads live behind /public/posts.
//
// Every other sort/page here is the SAME viewer-independent payload
// /public/posts serves, plus a thin viewer overlay — so the shared part is read
// through the public route's own Cache API entry (getCachedPublicPayload) and
// only the overlay hits Turso on a warm entry. Signed-in reads therefore see
// counts/content up to the public TTL stale, the window anonymous readers
// already accept; own actions stay instant via the client's optimistic patches
// and the overlay (isLiked/isReposted/blocks) is always fresh.
//
// The `id` segment is re-encoded into the cache key: Hono percent-DECODES route
// params, so a raw `../…` id would resolve the key URL onto another route's
// entry.
export const postsRoutes = new Hono<AppBindings>()
  .get(
    "/posts",
    withPrivateRead("fetching posts", async (c) => {
      const cursor = c.req.query("cursor") ?? null;
      const sort = normalizeFeedSort(c.req.query("sort"));
      const { session } = await getSessionFrom(c);
      const db = resolveDb(c.env);

      if (sort === "following") {
        if (!session) {
          return Response.json({ error: UNAUTHORIZED_ERROR }, { status: 401 });
        }
        // Per-viewer by nature — no public twin, never cached.
        return getPostsPage(db, c.env.KV, {
          cursor,
          sort,
          viewerId: session.userId,
        });
      }

      const publicData = await getCachedPublicPayload<FeedResponse>(
        c,
        "/public/posts",
        { sort, cursor },
        PUBLIC_POSTS_MAX_AGE,
        PUBLIC_BROWSER_MAX_AGE,
        () => getPostsPage(db, c.env.KV, { cursor, sort }),
      );

      return getPostsPage(db, c.env.KV, {
        cursor,
        sort,
        viewerId: session?.userId,
        publicData,
      });
    }),
  )
  .get(
    "/posts/:id",
    withPrivateRead("fetching post", async (c) => {
      const postId = c.req.param("id") ?? "";
      const { session } = await getSessionFrom(c);
      const db = resolveDb(c.env);

      const publicPost = await getCachedPublicPayload<PostResponse>(
        c,
        `/public/posts/${encodeURIComponent(postId)}`,
        {},
        PUBLIC_POST_MAX_AGE,
        PUBLIC_BROWSER_MAX_AGE,
        () => getPostById(db, { postId }),
      );

      if (!publicPost) return null;

      const result = await getPostById(db, {
        postId,
        viewerId: session?.userId,
        publicPost,
      });
      return result ?? null;
    }),
  )
  .get(
    "/posts/:id/comments",
    withPrivateRead("fetching comments", async (c) => {
      const postId = c.req.param("id") ?? "";
      const cursor = c.req.query("cursor") ?? null;
      const { session } = await getSessionFrom(c);
      const db = resolveDb(c.env);

      const publicData = await getCachedPublicPayload<CommentsResponse>(
        c,
        `/public/posts/${encodeURIComponent(postId)}/comments`,
        { cursor },
        PUBLIC_COMMENTS_MAX_AGE,
        PUBLIC_BROWSER_MAX_AGE,
        () => getPostCommentsPage(db, { postId, cursor }),
      );

      return getPostCommentsPage(db, {
        postId,
        cursor,
        viewerId: session?.userId,
        publicData,
      });
    }),
  );
