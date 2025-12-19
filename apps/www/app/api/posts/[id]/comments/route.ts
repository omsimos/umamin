import { db } from "@umamin/db";
import {
  postCommentTable,
  postCommentUpvoteTable,
} from "@umamin/db/schema/post";
import { userTable } from "@umamin/db/schema/user";
import { and, desc, eq, exists, lt, or, sql } from "drizzle-orm";
import { cacheLife } from "next/cache";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";

const PAGE_SIZE = 20;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const postId = (await params).id;
    const searchParams = req.nextUrl.searchParams;
    const cursor = searchParams.get("cursor");
    const { session } = await getSession();

    const result = await (async () => {
      "use cache: private";
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

      const isLikedExpr = session
        ? exists(
            db
              .select({ id: postCommentUpvoteTable.id })
              .from(postCommentUpvoteTable)
              .where(
                and(
                  eq(postCommentUpvoteTable.commentId, postCommentTable.id),
                  eq(postCommentUpvoteTable.userId, session.userId),
                ),
              ),
          )
        : sql<boolean>`false`;

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
          isLiked: isLikedExpr,
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

      const commentsData = rows.map(({ comment, author, isLiked }) => ({
        ...comment,
        author,
        isLiked: Boolean(isLiked),
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
