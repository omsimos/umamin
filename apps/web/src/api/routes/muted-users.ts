import { Hono } from "hono";
import type { AppBindings } from "../../server-lib/context";
import { getMutedUsersPage } from "../../server-lib/data";
import { UNAUTHORIZED_ERROR } from "../../server-lib/errors";
import { withPrivateRead } from "../../server-lib/read-route";
import { getSessionFrom, resolveDb } from "./_shared";

export const mutedUsersRoutes = new Hono<AppBindings>().get(
  "/muted-users",
  withPrivateRead("fetching muted users", async (c) => {
    const { session } = await getSessionFrom(c);
    if (!session) {
      return Response.json({ error: UNAUTHORIZED_ERROR }, { status: 401 });
    }

    return getMutedUsersPage(resolveDb(c.env), {
      viewerId: session.userId,
      cursor: c.req.query("cursor") ?? null,
    });
  }),
);
