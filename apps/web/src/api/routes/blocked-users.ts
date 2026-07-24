import { Hono } from "hono";
import type { AppBindings } from "../../server-lib/context";
import { getBlockedUsersPage } from "../../server-lib/data";
import { withPrivateRead } from "../../server-lib/read-route";
import { getSessionFrom, resolveDb } from "./_shared";

export const blockedUsersRoutes = new Hono<AppBindings>().get(
  "/blocked-users",
  withPrivateRead("fetching blocked users", async (c) => {
    const { session } = await getSessionFrom(c);
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    return getBlockedUsersPage(resolveDb(c.env), {
      viewerId: session.userId,
      cursor: c.req.query("cursor") ?? null,
    });
  }),
);
