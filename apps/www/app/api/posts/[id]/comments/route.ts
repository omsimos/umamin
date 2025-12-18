import { db } from "@umamin/db";
import { postCommentTable } from "@umamin/db/schema/post";
import { userTable } from "@umamin/db/schema/user";
import { and, desc, eq, lt, or } from "drizzle-orm";
import { cacheLife } from "next/cache";
import type { NextRequest } from "next/server";

const PAGE_SIZE = 20;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const postId = (await params).id;
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
            lt(postCommentTable.createdAt, cursorDate),
            and(
              eq(postCommentTable.createdAt, cursorDate),
              lt(postCommentTable.id, cursorId),
            ),
          );
        }
      }

      const baseQuery = db
        .select({
          comment: postCommentTable,
          author: {
            id: userTable.id,
            username: userTable.username,
            displayName: userTable.displayName,
            imageUrl: userTable.imageUrl,
            quietMode: userTable.quietMode,
            createdAt: userTable.createdAt,
          },
        })
        .from(postCommentTable)
        .leftJoin(userTable, eq(postCommentTable.authorId, userTable.id))
        .orderBy(desc(postCommentTable.createdAt), desc(postCommentTable.id))
        .limit(PAGE_SIZE);

      const rows = await baseQuery.where(
        cursorCondition
          ? and(eq(postCommentTable.postId, postId), cursorCondition)
          : eq(postCommentTable.postId, postId),
      );

      const commentsData = rows.map(({ comment, author }) => ({
        ...comment,
        author,
      }));

      return {
        data: commentsData,
        nextCursor:
          commentsData.length === PAGE_SIZE
            ? `${commentsData[commentsData.length - 1].createdAt.getTime()}.${
                commentsData[commentsData.length - 1].id
              }`
            : null,
      };
    })();

    return Response.json(result);
  } catch (error) {
    console.error("Error fetching comments:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
