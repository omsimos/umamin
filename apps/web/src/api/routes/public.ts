import { Hono } from "hono";
import { DEFAULT_FEED_SORT, normalizeFeedSort } from "../../lib/feed-sort";
import {
  LEADERBOARD_MAX_AGE_SECONDS,
  parseLeaderboardTab,
} from "../../lib/leaderboard";
import { PUBLIC_PROFILE_MAX_AGE_SECONDS } from "../../lib/profile-cache";
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
import { INVALID_INPUT_ERROR, NOT_FOUND_ERROR } from "../../server-lib/errors";
import { isModerationEnforced } from "../../server-lib/flags";
import { getLeaderboard } from "../../server-lib/leaderboard";
import { withPublicRead } from "../../server-lib/read-route";
import { formatUsername, resolveDb } from "./_shared";

const notFound = () =>
  Response.json({ error: NOT_FOUND_ERROR }, { status: 404 });

// TTLs for the four entries the PRIVATE routes also read and fill through
// getCachedPublicPayload (api/routes/posts.ts, api/routes/notes.ts) so one
// Turso fill serves signed-in and anonymous traffic alike. Both sides must
// declare the same numbers, hence the shared constants.
export const PUBLIC_POSTS_MAX_AGE = 180;
export const PUBLIC_POST_MAX_AGE = 120;
export const PUBLIC_COMMENTS_MAX_AGE = 120;
export const PUBLIC_NOTES_MAX_AGE = 180;
export const PUBLIC_BROWSER_MAX_AGE = 60;

// Anonymous, CDN-cached (Cache API) reads. TTLs preserved from apps/www EXCEPT
// the public profile: 7d → 300s (plan) — tag purge is gone, so a short TTL plus
// own-device setQueryData covers freshness.
//
// `isModerationEnforced` is awaited before each query rather than alongside
// it: the flag decides what the query returns (Hot eligibility and ranking,
// the labels baked into the shared entry). It reads the cron-refreshed flag
// snapshot: one KV read per isolate per minute, or a live PostHog call of up to
// a second when no fresh snapshot exists (before the first cron run, or after
// the cron has stopped).
export const publicRoutes = new Hono<AppBindings>()
  .get(
    "/public/leaderboard",
    withPublicRead(
      "fetching leaderboard",
      LEADERBOARD_MAX_AGE_SECONDS,
      async (req, env) => {
        // An unknown tab is a 400 (never cached) rather than a fallback, so
        // junk values can't mint cache entries and Turso reads.
        const tab = parseLeaderboardTab(req.query("tab") ?? "aura");
        if (!tab) {
          return Response.json({ error: INVALID_INPUT_ERROR }, { status: 400 });
        }
        return getLeaderboard(resolveDb(env), tab);
      },
      PUBLIC_BROWSER_MAX_AGE,
      ["tab"],
    ),
  )
  .get(
    "/public/posts",
    withPublicRead(
      "fetching public posts",
      PUBLIC_POSTS_MAX_AGE,
      async (req, env) => {
        const requestedSort = normalizeFeedSort(req.query("sort"));
        const sort =
          requestedSort === "following" ? DEFAULT_FEED_SORT : requestedSort;
        return getPostsPage(resolveDb(env), env.KV, {
          cursor: req.query("cursor") ?? null,
          sort,
          enforce: await isModerationEnforced(env),
        });
      },
      PUBLIC_BROWSER_MAX_AGE,
      ["sort", "cursor"],
    ),
  )
  .get(
    "/public/posts/:id/comments",
    withPublicRead(
      "fetching public comments",
      PUBLIC_COMMENTS_MAX_AGE,
      async (req, env) =>
        getPostCommentsPage(resolveDb(env), {
          postId: req.param("id") ?? "",
          cursor: req.query("cursor") ?? null,
          enforce: await isModerationEnforced(env),
        }),
      PUBLIC_BROWSER_MAX_AGE,
      ["cursor"],
    ),
  )
  .get(
    "/public/posts/:id",
    withPublicRead(
      "fetching public post",
      PUBLIC_POST_MAX_AGE,
      async (req, env) => {
        const result = await getPostById(resolveDb(env), {
          postId: req.param("id") ?? "",
          enforce: await isModerationEnforced(env),
        });
        return result ?? notFound();
      },
      PUBLIC_BROWSER_MAX_AGE,
      [],
    ),
  )
  .get(
    "/public/notes",
    withPublicRead(
      "fetching public notes",
      PUBLIC_NOTES_MAX_AGE,
      async (req, env) =>
        getNotesPage(resolveDb(env), {
          cursor: req.query("cursor") ?? null,
          enforce: await isModerationEnforced(env),
        }),
      PUBLIC_BROWSER_MAX_AGE,
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
        const [user, enforce] = await Promise.all([
          getPublicUserProfileData(db, username),
          isModerationEnforced(env),
        ]);
        if (!user) return notFound();

        return getUserPostsPage(db, {
          authorId: user.id,
          cursor: req.query("cursor") ?? null,
          enforce,
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
      PUBLIC_PROFILE_MAX_AGE_SECONDS,
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
