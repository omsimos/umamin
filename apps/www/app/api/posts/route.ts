import { db } from "@umamin/db";
import { postTable } from "@umamin/db/schema/post";
import { userTable } from "@umamin/db/schema/user";
import { and, desc, eq, lt, or } from "drizzle-orm";
import { cacheLife } from "next/cache";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const cursor = searchParams.get("cursor");

    const result = await (async () => {
      "use cache";
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
            lt(postTable.updatedAt, cursorDate),
            and(
              eq(postTable.updatedAt, cursorDate),
              lt(postTable.id, cursorId),
            ),
          );
        }
      }

      const baseQuery = db
        .select({
          post: postTable,
          author: {
            id: userTable.id,
            username: userTable.username,
            displayName: userTable.displayName,
            imageUrl: userTable.imageUrl,
            quietMode: userTable.quietMode,
            createdAt: userTable.createdAt,
          },
        })
        .from(postTable)
        .leftJoin(userTable, eq(postTable.authorId, userTable.id))
        .orderBy(desc(postTable.createdAt), desc(postTable.id))
        .limit(40);

      const rows = await (cursorCondition
        ? baseQuery.where(cursorCondition)
        : baseQuery);

      const postsData = rows.map(({ post, author }) => ({ ...post, author }));

      return {
        data: postsData,
        nextCursor:
          postsData.length === 40
            ? `${postsData[postsData.length - 1].createdAt.getTime()}.${
                postsData[postsData.length - 1].id
              }`
            : null,
      };
    })();

    return Response.json(result);
  } catch (error) {
    console.error("Error fetching posts:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
