import { db } from "@umamin/db";
import { noteTable } from "@umamin/db/schema/note";
import { userTable } from "@umamin/db/schema/user";
import { and, desc, eq, lt, or } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const cursor = searchParams.get("cursor");

    const result = await unstable_cache(
      async () => {
        // biome-ignore lint/suspicious/noImplicitAnyLet: temp
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

        const baseQuery = db
          .select({
            note: noteTable,
            user: {
              id: userTable.id,
              username: userTable.username,
              displayName: userTable.displayName,
              imageUrl: userTable.imageUrl,
              quietMode: userTable.quietMode,
            },
          })
          .from(noteTable)
          .leftJoin(userTable, eq(noteTable.userId, userTable.id))
          .orderBy(desc(noteTable.updatedAt), desc(noteTable.id))
          .limit(10);

        const rows = await (cursorCondition
          ? baseQuery.where(cursorCondition)
          : baseQuery);

        const notes = rows.map(({ note, user }) => ({
          ...note,
          user: user ?? undefined,
        }));

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
