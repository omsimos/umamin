import type { NextRequest } from "next/server";
import { desc, lt, and, or, eq } from "drizzle-orm";

import { noteTable } from "@umamin/db/schema/note";
import { db } from "@umamin/db/index";

export const revalidate = 30;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const cursor = searchParams.get("cursor");

    let cursorCondition;

    if (cursor) {
      const [updatedAt, cursorId] = cursor.split("_");
      const cursorDate = new Date(updatedAt);

      cursorCondition = or(
        lt(noteTable.updatedAt, cursorDate),
        and(eq(noteTable.updatedAt, cursorDate), lt(noteTable.id, cursorId)),
      );
    }

    let posts = [];

    posts = await db.query.noteTable.findMany({
      with: {
        user: true,
      },
      where: cursorCondition,
      orderBy: [desc(noteTable.updatedAt), desc(noteTable.id)],
      limit: 10,
    });

    return Response.json({
      data: posts,
      nextCursor:
        posts.length === 10
          ? `${posts[posts.length - 1].updatedAt}_${posts[posts.length - 1].id}`
          : null,
    });
  } catch (error) {
    console.error("Error fetching posts:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
