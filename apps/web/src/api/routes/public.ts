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
import { withPublicRead } from "../../server-lib/read-route";
import { formatUsername, resolveDb } from "./_shared";

const notFound = () => Response.json({ error: "Not found" }, { status: 404 });

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
      300,
    ),
  );
