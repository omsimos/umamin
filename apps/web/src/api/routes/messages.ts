import { Hono } from "hono";
import type { AppBindings } from "../../server-lib/context";
import { getMessagesPage } from "../../server-lib/data";
import { withPrivateRead } from "../../server-lib/read-route";
import { getSessionFrom, resolveDb } from "./_shared";

export const messagesRoutes = new Hono<AppBindings>().get(
  "/messages",
  withPrivateRead("fetching messages", async (c) => {
    const { session } = await getSessionFrom(c);
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const type = c.req.query("type") === "sent" ? "sent" : "received";
    return getMessagesPage(resolveDb(c.env), {
      type,
      cursor: c.req.query("cursor") ?? null,
      userId: session.userId,
    });
  }),
);
