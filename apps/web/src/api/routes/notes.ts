import { Hono } from "hono";
import type { AppBindings } from "../../server-lib/context";
import { getCurrentNoteData, getNotesPage } from "../../server-lib/data";
import { withPrivateRead } from "../../server-lib/read-route";
import { getSessionFrom, resolveDb } from "./_shared";

export const notesRoutes = new Hono<AppBindings>()
  .get(
    "/notes",
    withPrivateRead("fetching notes", async (c) => {
      const { session } = await getSessionFrom(c);
      return getNotesPage(resolveDb(c.env), {
        cursor: c.req.query("cursor") ?? null,
        viewerId: session?.userId,
      });
    }),
  )
  .get(
    "/notes/current",
    withPrivateRead("fetching current note", async (c) => {
      const { session } = await getSessionFrom(c);
      if (!session?.userId) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      const note = await getCurrentNoteData(resolveDb(c.env), session.userId);
      return note ?? Response.json(null);
    }),
  );
