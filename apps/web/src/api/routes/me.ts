import { Hono } from "hono";
import type { AppBindings } from "../../server-lib/context";
import { getCurrentUserData } from "../../server-lib/data";
import { withPrivateRead } from "../../server-lib/read-route";
import { getSessionFrom, resolveDb } from "./_shared";

export const meRoutes = new Hono<AppBindings>().get(
  "/me",
  withPrivateRead("fetching current user", async (c) => {
    const { session } = await getSessionFrom(c);
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    return getCurrentUserData(
      resolveDb(c.env),
      session.userId,
      c.env.MODERATOR_USERS,
    );
  }),
);
