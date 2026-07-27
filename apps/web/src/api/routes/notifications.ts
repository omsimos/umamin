import { Hono } from "hono";
import type { AppBindings } from "../../server-lib/context";
import {
  getNotificationBadgeData,
  getNotificationsPage,
} from "../../server-lib/data";
import { withPrivateRead } from "../../server-lib/read-route";
import { getSessionFrom, resolveDb } from "./_shared";

export const notificationsRoutes = new Hono<AppBindings>()
  .get(
    "/notifications",
    withPrivateRead("fetching notifications", async (c) => {
      const { session } = await getSessionFrom(c);
      if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      return getNotificationsPage(resolveDb(c.env), {
        viewerId: session.userId,
        cursor: c.req.query("cursor") ?? null,
      });
    }),
  )
  .get(
    "/notifications/badge",
    withPrivateRead("fetching notification badge", async (c) => {
      const { session } = await getSessionFrom(c);
      if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      return getNotificationBadgeData(resolveDb(c.env), session.userId);
    }),
  );
