import type { NextRequest } from "next/server";
import { desc, lt, and, or, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { noteTable } from "@umamin/db/schema/note";
import { db } from "@umamin/db";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const cursor = searchParams.get("cursor");

    const result = await unstable_cache(
      async () => {
        let cursorCondition;
        if (cursor) {
          const sep = cursor.indexOf(".");
          if (sep > 0) {
            const ms = Number(cursor.slice(0, sep));
            const cursorId = cursor.slice(sep + 1);
            const cursorDate = new Date(ms);
            cursorCondition = or(
              lt(noteTable.updatedAt, cursorDate),
              and(
                eq(noteTable.updatedAt, cursorDate),
                lt(noteTable.id, cursorId),
              ),
            );
          }
        }

        const base = {
          with: {
            user: {
              columns: {
                id: true,
                username: true,
                displayName: true,
                imageUrl: true,
                quietMode: true,
              },
            },
          },
          orderBy: [desc(noteTable.updatedAt), desc(noteTable.id)],
          limit: 10,
        };

        const notes = cursorCondition
          ? await db.query.noteTable.findMany({
              ...base,
              where: cursorCondition,
            })
          : await db.query.noteTable.findMany(base);

        const notesData = notes.map(({ user, userId, ...note }) =>
          note.isAnonymous ? { ...note } : { user, userId, ...note },
        );

        return {
          data: notesData,
          nextCursor:
            notesData.length === 10
              ? `${notesData[notesData.length - 1].updatedAt?.getTime()}.${
                  notesData[notesData.length - 1].id
                }`
              : null,
        };
      },
      ["api-notes", cursor ?? ""],
      {
        revalidate: 30,
      },
    )();

    return Response.json(result);
  } catch (error) {
    console.error("Error fetching notes:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
