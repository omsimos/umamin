import { db } from "@umamin/db";
import { noteTable } from "@umamin/db/schema/note";
import { userBlockTable, userTable } from "@umamin/db/schema/user";
import { and, desc, eq, exists, lt, not, or } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const cursor = searchParams.get("cursor");
    const { session } = await getSession();

    const result = await (async () => {
      "use cache: private";
      cacheTag("notes");
      if (session) {
        cacheTag(`user-blocks:${session.userId}`);
      }
      cacheLife({ revalidate: 30 });

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

      const blockedAuthorCondition = session
        ? and(
            not(
              exists(
                db
                  .select({ id: userBlockTable.id })
                  .from(userBlockTable)
                  .where(
                    and(
                      eq(userBlockTable.blockerId, session.userId),
                      eq(userBlockTable.blockedId, noteTable.userId),
                    ),
                  ),
              ),
            ),
            not(
              exists(
                db
                  .select({ id: userBlockTable.id })
                  .from(userBlockTable)
                  .where(
                    and(
                      eq(userBlockTable.blockerId, noteTable.userId),
                      eq(userBlockTable.blockedId, session.userId),
                    ),
                  ),
              ),
            ),
          )
        : undefined;

      const baseQuery = db
        .select({
          note: noteTable,
          user: {
            id: userTable.id,
            username: userTable.username,
            displayName: userTable.displayName,
            imageUrl: userTable.imageUrl,
            quietMode: userTable.quietMode,
            createdAt: userTable.createdAt,
          },
        })
        .from(noteTable)
        .leftJoin(userTable, eq(noteTable.userId, userTable.id))
        .orderBy(desc(noteTable.updatedAt), desc(noteTable.id))
        .limit(40);

      const whereCondition = cursorCondition
        ? blockedAuthorCondition
          ? and(cursorCondition, blockedAuthorCondition)
          : cursorCondition
        : blockedAuthorCondition;

      const rows = await (whereCondition
        ? baseQuery.where(whereCondition)
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
          notesData.length === 40
            ? `${notesData[notesData.length - 1].updatedAt?.getTime()}.${
                notesData[notesData.length - 1].id
              }`
            : null,
      };
    })();

    return Response.json(result);
  } catch (error) {
    console.error("Error fetching notes:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
