import type { NextRequest } from "next/server";
import { desc, lt, and, or, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { noteTable } from "@umamin/db/schema/note";
import { db } from "@umamin/db";

export const revalidate = 60;

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

        const posts = await db.query.noteTable.findMany({
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
          where: cursorCondition,
          orderBy: [desc(noteTable.updatedAt), desc(noteTable.id)],
          limit: 10,
        });

        return {
          data: posts,
          nextCursor:
            posts.length === 10
              ? `${posts[posts.length - 1].updatedAt?.getTime()}.${
                  posts[posts.length - 1].id
                }`
              : null,
        };
      },
      ["api-notes", cursor ?? ""],
      {
        revalidate: 30,
        tags: cursor ? [] : ["notes:head"],
      },
    )();

    return Response.json(result);
  } catch (error) {
    console.error("Error fetching posts:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
