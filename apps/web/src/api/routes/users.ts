import type { Context } from "hono";
import { Hono } from "hono";
import type { AppBindings } from "../../server-lib/context";
import {
  getFollowListPage,
  getPublicUserProfileData,
  getUserProfileViewerData,
} from "../../server-lib/data";
import type { AppEnv } from "../../server-lib/env";
import { NOT_FOUND_ERROR, USER_NOT_FOUND_ERROR } from "../../server-lib/errors";
import { isModerator } from "../../server-lib/moderation";
import { withPrivateRead } from "../../server-lib/read-route";
import { formatUsername, getSessionFrom, resolveDb } from "./_shared";

async function followList(
  c: Context<{ Bindings: AppEnv }>,
  direction: "followers" | "following",
) {
  const db = resolveDb(c.env);
  const username = formatUsername(c.req.param("username") ?? "");
  const cursor = c.req.query("cursor") ?? null;

  const [profile, { session }] = await Promise.all([
    username ? getPublicUserProfileData(db, username) : Promise.resolve(null),
    getSessionFrom(c),
  ]);
  if (!profile) {
    return Response.json({ error: USER_NOT_FOUND_ERROR }, { status: 404 });
  }

  return getFollowListPage(db, {
    userId: profile.id,
    direction,
    cursor,
    viewerId: session?.userId,
  });
}

export const usersRoutes = new Hono<AppBindings>()
  .get(
    "/user/:username/followers",
    withPrivateRead("fetching followers", (c) => followList(c, "followers")),
  )
  .get(
    "/user/:username/following",
    withPrivateRead("fetching following", (c) => followList(c, "following")),
  )
  .get(
    "/user/:username/viewer",
    withPrivateRead("fetching user profile viewer overlay", async (c) => {
      const username = formatUsername(c.req.param("username") ?? "");
      const { session, user } = await getSessionFrom(c);
      const result = await getUserProfileViewerData(
        resolveDb(c.env),
        username,
        session?.userId,
        { viewerIsModerator: isModerator(user, c.env.MODERATOR_USERS) },
      );

      if (!result) {
        return Response.json({ error: NOT_FOUND_ERROR }, { status: 404 });
      }
      return result;
    }),
  );
