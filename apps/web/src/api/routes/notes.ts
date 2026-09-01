import { Hono } from "hono";
import type { NotesResponse } from "../../lib/types";
import type { AppBindings } from "../../server-lib/context";
import { getCurrentNoteData, getNotesPage } from "../../server-lib/data";
import { UNAUTHORIZED_ERROR } from "../../server-lib/errors";
import {
  getCachedPublicPayload,
  withPrivateRead,
} from "../../server-lib/read-route";
import { getSessionFrom, resolveDb } from "./_shared";
import { PUBLIC_BROWSER_MAX_AGE, PUBLIC_NOTES_MAX_AGE } from "./public";

export const notesRoutes = new Hono<AppBindings>()
  .get(
    "/notes",
    // Same shared-entry-plus-overlay split as /posts (see api/routes/posts.ts):
    // the notes page itself is viewer-independent, so it is read through
    // /public/notes' own Cache API entry and only the overlay stays per-viewer.
    withPrivateRead("fetching notes", async (c) => {
      const cursor = c.req.query("cursor") ?? null;
      const { session } = await getSessionFrom(c);
      const db = resolveDb(c.env);

      const publicData = await getCachedPublicPayload<NotesResponse>(
        c,
        "/public/notes",
        { cursor },
        PUBLIC_NOTES_MAX_AGE,
        PUBLIC_BROWSER_MAX_AGE,
        () => getNotesPage(db, { cursor }),
      );

      return getNotesPage(db, {
        cursor,
        viewerId: session?.userId,
        publicData,
      });
    }),
  )
  .get(
    "/notes/current",
    withPrivateRead("fetching current note", async (c) => {
      const { session } = await getSessionFrom(c);
      if (!session?.userId) {
        return Response.json({ error: UNAUTHORIZED_ERROR }, { status: 401 });
      }

      const note = await getCurrentNoteData(resolveDb(c.env), session.userId);
      return note ?? Response.json(null);
    }),
  );
