import { Hono } from "hono";
import type { AppBindings } from "../../server-lib/context";
import { getMessagesPage, getMessageThread } from "../../server-lib/data";
import { NOT_FOUND_ERROR, UNAUTHORIZED_ERROR } from "../../server-lib/errors";
import { withPrivateRead } from "../../server-lib/read-route";
import { getSessionFrom, resolveDb } from "./_shared";

export const messagesRoutes = new Hono<AppBindings>()
  .get(
    "/messages",
    withPrivateRead("fetching messages", async (c) => {
      const { session } = await getSessionFrom(c);
      if (!session) {
        return Response.json({ error: UNAUTHORIZED_ERROR }, { status: 401 });
      }

      const type = c.req.query("type") === "sent" ? "sent" : "received";
      return getMessagesPage(resolveDb(c.env), {
        type,
        cursor: c.req.query("cursor") ?? null,
        userId: session.userId,
      });
    }),
  )
  .get(
    "/messages/:id/thread",
    withPrivateRead("fetching message thread", async (c) => {
      const { session } = await getSessionFrom(c);
      if (!session) {
        return Response.json({ error: UNAUTHORIZED_ERROR }, { status: 401 });
      }

      const messageId = c.req.param("id");
      if (!messageId) {
        return Response.json({ error: NOT_FOUND_ERROR }, { status: 404 });
      }

      const thread = await getMessageThread(resolveDb(c.env), {
        messageId,
        viewerId: session.userId,
      });

      // Non-participant, blocked, or missing all read as not-found — the
      // thread's existence is never confirmed to outsiders.
      if (!thread) {
        return Response.json({ error: NOT_FOUND_ERROR }, { status: 404 });
      }

      return thread;
    }),
  );
