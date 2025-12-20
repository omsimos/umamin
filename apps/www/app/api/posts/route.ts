/** biome-ignore-all lint/suspicious/noImplicitAnyLet: temp */
import { db } from "@umamin/db";
import {
  postLikeTable,
  postRepostTable,
  postTable,
} from "@umamin/db/schema/post";
import { userTable } from "@umamin/db/schema/user";
import { and, desc, eq, exists, lt, or, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const { session } = await getSession();
    const cursor = searchParams.get("cursor");

    const result = await (async () => {
      "use cache: private";
      cacheTag("posts");
      cacheLife({ revalidate: 30 });

      const PAGE_SIZE = 40;
      let cursorConditionPost;
      let cursorConditionRepost;

      if (cursor) {
        const [msRaw, typeRaw, idRaw] = cursor.split(".");
        const ms = Number(msRaw);
        const cursorDate = Number.isNaN(ms) ? null : new Date(ms);
        const isRepostCursor = typeRaw === "repost";

        if (cursorDate && idRaw) {
          if (isRepostCursor) {
            cursorConditionRepost = or(
              lt(postRepostTable.createdAt, cursorDate),
              and(
                eq(postRepostTable.createdAt, cursorDate),
                lt(postRepostTable.id, idRaw),
              ),
            );
            cursorConditionPost = or(
              lt(postTable.createdAt, cursorDate),
              and(eq(postTable.createdAt, cursorDate), lt(postTable.id, idRaw)),
            );
          } else {
            cursorConditionPost = or(
              lt(postTable.createdAt, cursorDate),
              and(eq(postTable.createdAt, cursorDate), lt(postTable.id, idRaw)),
            );
            cursorConditionRepost = lt(postRepostTable.createdAt, cursorDate);
          }
        }
      }

      const isLikedExpr = session
        ? exists(
            db
              .select({ id: postLikeTable.id })
              .from(postLikeTable)
              .where(
                and(
                  eq(postLikeTable.postId, postTable.id),
                  eq(postLikeTable.userId, session.userId),
                ),
              ),
          )
        : sql<boolean>`false`;

      const isRepostedExpr = session
        ? exists(
            db
              .select({ id: postRepostTable.id })
              .from(postRepostTable)
              .where(
                and(
                  eq(postRepostTable.postId, postTable.id),
                  eq(postRepostTable.userId, session.userId),
                ),
              ),
          )
        : sql<boolean>`false`;

      const basePostQuery = db
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
          isLiked: isLikedExpr,
          isReposted: isRepostedExpr,
        })
        .from(postTable)
        .leftJoin(userTable, eq(postTable.authorId, userTable.id))
        .orderBy(desc(postTable.createdAt), desc(postTable.id));

      const postRows = await (cursorConditionPost
        ? basePostQuery.where(cursorConditionPost)
        : basePostQuery
      ).limit(PAGE_SIZE);

      const postItems = postRows
        .filter((row) => row.author !== null)
        .map(({ post, author, isLiked, isReposted }) => ({
          type: "post" as const,
          post: {
            ...post,
            author,
            isLiked: Boolean(isLiked),
            isReposted: Boolean(isReposted),
          },
        }));

      const baseRepostQuery = db
        .select({
          repost: postRepostTable,
          post: postTable,
          authorId: postTable.authorId,
          reposterId: postRepostTable.userId,
          isLiked: isLikedExpr,
          isReposted: isRepostedExpr,
        })
        .from(postRepostTable)
        .innerJoin(postTable, eq(postRepostTable.postId, postTable.id))
        .orderBy(desc(postRepostTable.createdAt), desc(postRepostTable.id));

      const repostRows = await (cursorConditionRepost
        ? baseRepostQuery.where(cursorConditionRepost)
        : baseRepostQuery
      ).limit(PAGE_SIZE);

      const userIds = new Set<string>();
      for (const row of repostRows) {
        if (row.authorId) userIds.add(row.authorId);
        if (row.reposterId) userIds.add(row.reposterId);
      }

      const users =
        userIds.size > 0
          ? await db
              .select({
                id: userTable.id,
                username: userTable.username,
                displayName: userTable.displayName,
                imageUrl: userTable.imageUrl,
                quietMode: userTable.quietMode,
                createdAt: userTable.createdAt,
              })
              .from(userTable)
              .where(
                or(...Array.from(userIds).map((id) => eq(userTable.id, id))),
              )
          : [];

      const userMap = new Map(users.map((u) => [u.id, u] as const));

      const repostItems: {
        type: "repost";
        post: {
          author: (typeof users)[number];
          isLiked: boolean;
          isReposted: boolean;
        } & typeof postTable.$inferSelect;
        repost: {
          id: string;
          postId: string;
          content?: string | null;
          createdAt: Date;
          user: (typeof users)[number];
        };
      }[] = [];

      for (const row of repostRows) {
        const author = userMap.get(row.authorId);
        const reposter = userMap.get(row.reposterId);
        if (!author || !reposter) continue;
        repostItems.push({
          type: "repost",
          post: {
            ...row.post,
            author,
            isLiked: Boolean(row.isLiked),
            isReposted: Boolean(row.isReposted),
          },
          repost: {
            id: row.repost.id,
            postId: row.repost.postId,
            content: row.repost.content ?? undefined,
            createdAt: row.repost.createdAt,
            user: reposter,
          },
        });
      }

      const allItems = [...postItems, ...repostItems].sort((a, b) => {
        const aDate = a.type === "post" ? a.post.createdAt : a.repost.createdAt;
        const bDate = b.type === "post" ? b.post.createdAt : b.repost.createdAt;

        if (aDate.getTime() !== bDate.getTime()) {
          return bDate.getTime() - aDate.getTime();
        }
        const aOrder = a.type === "repost" ? 1 : 0;
        const bOrder = b.type === "repost" ? 1 : 0;
        if (aOrder !== bOrder) return bOrder - aOrder;

        const aId = a.type === "post" ? a.post.id : a.repost.id;
        const bId = b.type === "post" ? b.post.id : b.repost.id;
        return bId.localeCompare(aId);
      });

      const pageItems = allItems.slice(0, PAGE_SIZE);

      const lastItem = pageItems[pageItems.length - 1];
      const nextCursor = lastItem
        ? `${
            lastItem.type === "post"
              ? lastItem.post.createdAt.getTime()
              : lastItem.repost.createdAt.getTime()
          }.${lastItem.type}.${
            lastItem.type === "post" ? lastItem.post.id : lastItem.repost.id
          }`
        : null;

      return {
        data: pageItems,
        nextCursor,
      };
    })();

    return Response.json(result);
  } catch (error) {
    console.error("Error fetching posts:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
