import { Hono } from "hono";
import type { AppBindings } from "../../server-lib/context";
import { NOT_FOUND_ERROR } from "../../server-lib/errors";
import { isModerationEnforced } from "../../server-lib/flags";
import { listDeniedIps } from "../../server-lib/ip-denylist";
import { isModerator } from "../../server-lib/moderation";
import {
  getDramaReviewPage,
  getSevereReviewPage,
} from "../../server-lib/moderation-review";
import { withPrivateRead } from "../../server-lib/read-route";
import { getSessionFrom, resolveDb } from "./_shared";

export const moderationRoutes = new Hono<AppBindings>()
  .get(
    "/moderation/review",
    withPrivateRead("fetching moderation review", async (c) => {
      const { user } = await getSessionFrom(c);
      if (!isModerator(user, c.env.MODERATOR_USERS)) {
        return Response.json({ error: NOT_FOUND_ERROR }, { status: 404 });
      }

      const db = resolveDb(c.env);
      const enforce = await isModerationEnforced(c.env);
      return c.req.query("kind") === "drama"
        ? getDramaReviewPage(db, enforce)
        : getSevereReviewPage(db, c.req.query("cursor") ?? null, enforce);
    }),
  )
  .get(
    "/moderation/ip-denylist",
    withPrivateRead("fetching ip denylist", async (c) => {
      const { user } = await getSessionFrom(c);
      // 404 (not 403) for non-moderators so the route's existence/role gate isn't
      // disclosed — mirrors the mod-delete actions' generic "not found".
      if (!isModerator(user, c.env.MODERATOR_USERS)) {
        return Response.json({ error: NOT_FOUND_ERROR }, { status: 404 });
      }

      return { ips: await listDeniedIps(c.env.KV) };
    }),
  );
