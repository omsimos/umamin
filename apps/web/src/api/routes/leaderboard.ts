import { Hono } from "hono";
import { parseLeaderboardTab } from "../../lib/leaderboard";
import type { AppBindings } from "../../server-lib/context";
import {
  INVALID_INPUT_ERROR,
  UNAUTHORIZED_ERROR,
} from "../../server-lib/errors";
import { getViewerRank } from "../../server-lib/leaderboard";
import { withPrivateRead } from "../../server-lib/read-route";
import { getSessionFrom, resolveDb } from "./_shared";

export const leaderboardRoutes = new Hono<AppBindings>().get(
  "/leaderboard/me",
  withPrivateRead("fetching leaderboard rank", async (c) => {
    const tab = parseLeaderboardTab(c.req.query("tab") ?? "aura");
    if (!tab) {
      return Response.json({ error: INVALID_INPUT_ERROR }, { status: 400 });
    }

    const { session } = await getSessionFrom(c);
    if (!session) {
      return Response.json({ error: UNAUTHORIZED_ERROR }, { status: 401 });
    }

    return getViewerRank(resolveDb(c.env), tab, session.userId);
  }),
);
