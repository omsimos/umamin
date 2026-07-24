import { Hono } from "hono";
import type { AppBindings } from "../../server-lib/context";
import { listDeniedIps } from "../../server-lib/ip-denylist";
import { isModerator } from "../../server-lib/moderation";
import { withPrivateRead } from "../../server-lib/read-route";
import { getSessionFrom } from "./_shared";

export const moderationRoutes = new Hono<AppBindings>().get(
  "/moderation/ip-denylist",
  withPrivateRead("fetching ip denylist", async (c) => {
    const { user } = await getSessionFrom(c);
    // 404 (not 403) for non-moderators so the route's existence/role gate isn't
    // disclosed — mirrors the mod-delete actions' generic "not found".
    if (!isModerator(user, c.env.MODERATOR_USERS)) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return { ips: await listDeniedIps(c.env.KV) };
  }),
);
