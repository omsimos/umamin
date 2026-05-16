import {
  clearNote,
  createNote,
  getCurrentNoteData,
  getNotesPage,
} from "@umamin/core";
import { Hono } from "hono";
import { PUBLIC_CACHE_SECONDS } from "../config";
import { jsonBody, requireSession } from "../context";
import { privateNoStore, publicCache, resultJson } from "../http";
import { getSession } from "../session";
import type { AppEnv } from "../types";

export const noteRoutes = new Hono<AppEnv>();

noteRoutes.get("/api/public/notes", async (c) => {
  publicCache(c, PUBLIC_CACHE_SECONDS);
  return c.json(await getNotesPage({ cursor: c.req.query("cursor") ?? null }));
});

noteRoutes.get("/api/notes", async (c) => {
  privateNoStore(c);
  const session = await getSession(c);
  return c.json(
    await getNotesPage({
      cursor: c.req.query("cursor") ?? null,
      viewerId: session.session?.userId,
    }),
  );
});

noteRoutes.post("/api/notes", async (c) =>
  resultJson(c, await createNote(await requireSession(c), await jsonBody(c))),
);

noteRoutes.delete("/api/notes/current", async (c) =>
  resultJson(c, await clearNote(await requireSession(c))),
);

noteRoutes.get("/api/notes/current", async (c) => {
  privateNoStore(c);
  const session = await requireSession(c);
  return c.json(await getCurrentNoteData(session.session.userId));
});
