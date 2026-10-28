import { Hono } from "hono";
import type { AppBindings } from "../../server-lib/context";
import { resolveDmPeer } from "../../server-lib/dm/access";
import {
  getDmThreadsPage,
  getDmUnreadCount,
} from "../../server-lib/dm/threads";
import { NOT_FOUND_ERROR, UNAUTHORIZED_ERROR } from "../../server-lib/errors";
import { isDmEnabled } from "../../server-lib/flags";
import { withPrivateRead } from "../../server-lib/read-route";
import { formatUsername, getSessionFrom, resolveDb } from "./_shared";

const notFound = () =>
  Response.json({ error: NOT_FOUND_ERROR }, { status: 404 });
const unauthorized = () =>
  Response.json({ error: UNAUTHORIZED_ERROR }, { status: 401 });

// Every DM read is per viewer and 404s while the feature flag is off.
export const dmRoutes = new Hono<AppBindings>()
  .get(
    "/dm/threads",
    withPrivateRead("fetching dm threads", async (c) => {
      if (!(await isDmEnabled(c.env))) return notFound();
      const { session } = await getSessionFrom(c);
      if (!session) return unauthorized();
      return getDmThreadsPage(
        resolveDb(c.env),
        session.userId,
        c.req.query("cursor") ?? null,
      );
    }),
  )
  .get(
    "/dm/unread",
    withPrivateRead("fetching dm unread", async (c) => {
      if (!(await isDmEnabled(c.env))) return notFound();
      const { session } = await getSessionFrom(c);
      if (!session) return { count: 0 };
      return {
        count: await getDmUnreadCount(resolveDb(c.env), session.userId),
      };
    }),
  )
  .get(
    "/dm/peer/:username",
    withPrivateRead("fetching dm peer", async (c) => {
      if (!(await isDmEnabled(c.env))) return notFound();
      const { session } = await getSessionFrom(c);
      if (!session) return unauthorized();
      const access = await resolveDmPeer(
        resolveDb(c.env),
        session.userId,
        formatUsername(c.req.param("username") ?? ""),
      );
      // A block reads as "not found", like everywhere else a block hides
      // someone.
      if (!access || access.blocked) return notFound();
      const { blocked: _blocked, ...peer } = access;
      return peer;
    }),
  );
