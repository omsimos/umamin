import { Hono } from "hono";
import { DEFAULT_FEED_SORT, normalizeFeedSort } from "../../lib/feed-sort";
import type { AppBindings } from "../../server-lib/context";
import {
  getNotesPage,
  getPostById,
  getPostCommentsPage,
  getPostsPage,
  getPublicUserProfileData,
  getPublicUserProfileWithBadge,
  getUserPostsPage,
} from "../../server-lib/data";
import { NOT_FOUND_ERROR } from "../../server-lib/errors";
import { withPublicRead } from "../../server-lib/read-route";
import { formatUsername, resolveDb } from "./_shared";

const notFound = () =>
  Response.json({ error: NOT_FOUND_ERROR }, { status: 404 });

// Anonymous, CDN-cached (Cache API) reads. TTLs preserved from apps/www EXCEPT
// the public profile: 7d → 300s (plan) — tag purge is gone, so a short TTL plus
// own-device setQueryData covers freshness.
export const publicRoutes = new Hono<AppBindings>()
  .get(
    "/public/posts",
    withPublicRead(
      "fetching public posts",
      180,
      async (req, env) => {
        const requestedSort = normalizeFeedSort(req.query("sort"));
        const sort =
          requestedSort === "following" ? DEFAULT_FEED_SORT : requestedSort;
        return getPostsPage(resolveDb(env), env.KV, {
          cursor: req.query("cursor") ?? null,
          sort,
        });
      },
      60,
      ["sort", "cursor"],
    ),
  )
  .get(
    "/public/posts/:id/comments",
    withPublicRead(
      "fetching public comments",
      120,
      async (req, env) =>
        getPostCommentsPage(resolveDb(env), {
          postId: req.param("id") ?? "",
          cursor: req.query("cursor") ?? null,
        }),
      60,
      ["cursor"],
    ),
  )
  .get(
    "/public/posts/:id",
    withPublicRead(
      "fetching public post",
      120,
      async (req, env) => {
        const result = await getPostById(resolveDb(env), {
          postId: req.param("id") ?? "",
        });
        return result ?? notFound();
      },
      60,
      [],
    ),
  )
  .get(
    "/public/notes",
    withPublicRead(
      "fetching public notes",
      180,
      async (req, env) =>
        getNotesPage(resolveDb(env), { cursor: req.query("cursor") ?? null }),
      60,
      ["cursor"],
    ),
  )
  .get(
    "/public/user/:username/posts",
    withPublicRead(
      "fetching public user posts",
      120,
      async (req, env) => {
        const db = resolveDb(env);
        const username = formatUsername(req.param("username") ?? "");
        const user = await getPublicUserProfileData(db, username);
        if (!user) return notFound();

        return getUserPostsPage(db, {
          authorId: user.id,
          cursor: req.query("cursor") ?? null,
        });
      },
      60,
      ["cursor"],
    ),
  )
  .get(
    "/public/user/:username",
    withPublicRead(
      "fetching public user profile",
      // 7d → 300s (plan): Cache API has no tag purge; a short TTL bounds
      // anonymous staleness while own-device reads stay fresh via setQueryData.
      300,
      async (req, env) => {
        const username = formatUsername(req.param("username") ?? "");
        const result = await getPublicUserProfileWithBadge(
          resolveDb(env),
          username,
        );
        return result ?? notFound();
      },
      // Browser TTL 0, unlike the other public reads. apps/www could pair its
      // long TTL with an `updateTag("user:<username>")` purge on every profile,
      // badge and aura write; the Cache API has none, so a non-zero browser TTL
      // pins an edited avatar/badge in the viewer's own cache for minutes with
      // no way to bust it — not even a reload. The 300s edge entry still
      // absorbs the load.
      0,
      [],
    ),
  );
