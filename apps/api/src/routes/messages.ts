import {
  createReply,
  deleteMessage,
  getMessagesPage,
  sendMessage,
} from "@umamin/core";
import { Hono } from "hono";
import { jsonBody, requireSession } from "../context";
import { privateNoStore, resultJson } from "../http";
import { getSession } from "../session";
import type { AppEnv } from "../types";

export const messageRoutes = new Hono<AppEnv>();

messageRoutes.get("/api/messages", async (c) => {
  privateNoStore(c);
  const session = await requireSession(c);
  const type = c.req.query("type") === "sent" ? "sent" : "received";
  return c.json(
    await getMessagesPage({
      type,
      cursor: c.req.query("cursor") ?? null,
      userId: session.session.userId,
    }),
  );
});

messageRoutes.post("/api/messages", async (c) =>
  resultJson(c, await sendMessage(await getSession(c), await jsonBody(c))),
);

messageRoutes.delete("/api/messages/:id", async (c) =>
  resultJson(
    c,
    await deleteMessage(await requireSession(c), c.req.param("id")),
  ),
);

messageRoutes.post("/api/messages/:id/reply", async (c) =>
  resultJson(
    c,
    await createReply(await requireSession(c), {
      ...(await jsonBody(c)),
      messageId: c.req.param("id"),
    }),
  ),
);
