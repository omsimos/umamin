"use server";

import { db } from "@umamin/db";
import {
  postCommentTable,
  postCommentUpvoteTable,
  postTable,
  postUpvoteTable,
} from "@umamin/db/schema/post";
import { and, eq, exists, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import * as z from "zod";
import { getSession } from "@/lib/auth";

const createPostSchema = z.object({
  content: z
    .string()
    .min(1, { error: "Content cannot be empty" })
    .max(500, { error: "Content cannot exceed 500 characters" }),
});

export async function getPostAction(id: string) {
  const res = await db.query.postTable.findFirst({
    with: {
      author: true,
    },
    where: eq(postTable.id, id),
  });

  if (!res) return res;

  const { session } = await getSession();

  if (!session) return res;

  const liked = await db
    .select({
      liked: exists(
        db
          .select({ id: postUpvoteTable.id })
          .from(postUpvoteTable)
          .where(
            and(
              eq(postUpvoteTable.postId, id),
              eq(postUpvoteTable.userId, session.userId),
            ),
          ),
      ),
    })
    .from(postTable)
    .where(eq(postTable.id, id))
    .limit(1);

  const isLiked = Boolean(liked?.[0]?.liked);

  return { ...res, isLiked };
}

export async function createPostAction(
  values: z.infer<typeof createPostSchema>,
) {
  try {
    const params = createPostSchema.safeParse(values);

    if (!params.success) {
      return { error: "Invalid input" };
    }

    const { content } = params.data;
    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    await db.insert(postTable).values({
      content,
      authorId: session.userId,
    });

    return { success: true };
  } catch (err) {
    console.log(err);
    return { error: "An error occurred" };
  }
}

const createCommentSchema = z.object({
  postId: z.string(),
  content: z
    .string()
    .min(1, { error: "Content cannot be empty" })
    .max(500, { error: "Content cannot exceed 500 characters" }),
});

export async function createCommentAction(
  values: z.infer<typeof createCommentSchema>,
) {
  try {
    const params = createCommentSchema.safeParse(values);

    if (!params.success) {
      return { error: "Invalid input" };
    }

    const { content, postId } = params.data;
    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    await db.insert(postCommentTable).values({
      postId,
      content,
      authorId: session.userId,
    });

    await db
      .update(postTable)
      .set({
        commentCount: sql`${postTable.commentCount} + 1`,
      })
      .where(eq(postTable.id, postId));

    updateTag(`post:${postId}`);

    return { success: true };
  } catch (err) {
    console.log(err);
    return { error: "An error occurred" };
  }
}

export async function addLikeAction({ postId }: { postId: string }) {
  try {
    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    const existing = await db.query.postUpvoteTable.findFirst({
      columns: { id: true },
      where: and(
        eq(postUpvoteTable.postId, postId),
        eq(postUpvoteTable.userId, session.userId),
      ),
    });

    if (existing) {
      return { success: true, alreadyLiked: true };
    }

    await db
      .insert(postUpvoteTable)
      .values({
        postId,
        userId: session.userId,
      })
      .onConflictDoNothing();

    await db
      .update(postTable)
      .set({
        upvoteCount: sql`${postTable.upvoteCount} + 1`,
      })
      .where(eq(postTable.id, postId));

    updateTag(`post:${postId}`);
    return { success: true };
  } catch (err) {
    console.log(err);
    return { error: "An error occurred" };
  }
}

export async function removeLikeAction({ postId }: { postId: string }) {
  try {
    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    const existing = await db.query.postUpvoteTable.findFirst({
      columns: { id: true },
      where: and(
        eq(postUpvoteTable.postId, postId),
        eq(postUpvoteTable.userId, session.userId),
      ),
    });

    if (!existing) {
      return { success: true, alreadyRemoved: true };
    }

    await db
      .delete(postUpvoteTable)
      .where(
        and(
          eq(postUpvoteTable.postId, postId),
          eq(postUpvoteTable.userId, session.userId),
        ),
      );

    await db
      .update(postTable)
      .set({
        upvoteCount: sql`CASE WHEN ${postTable.upvoteCount} > 0 THEN ${postTable.upvoteCount} - 1 ELSE 0 END`,
      })
      .where(eq(postTable.id, postId));

    updateTag(`post:${postId}`);

    return { success: true };
  } catch (err) {
    console.log(err);
    return { error: "An error occurred" };
  }
}

export async function addCommentLikeAction({
  commentId,
}: {
  commentId: string;
}) {
  try {
    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    const existing = await db.query.postCommentUpvoteTable.findFirst({
      columns: { id: true },
      where: and(
        eq(postCommentUpvoteTable.commentId, commentId),
        eq(postCommentUpvoteTable.userId, session.userId),
      ),
    });

    if (existing) {
      return { success: true, alreadyLiked: true };
    }

    await db
      .insert(postCommentUpvoteTable)
      .values({
        commentId,
        userId: session.userId,
      })
      .onConflictDoNothing();

    await db
      .update(postCommentTable)
      .set({
        upvoteCount: sql`${postCommentTable.upvoteCount} + 1`,
      })
      .where(eq(postCommentTable.id, commentId));

    return { success: true };
  } catch (err) {
    console.log(err);
    return { error: "An error occurred" };
  }
}

export async function removeCommentLikeAction({
  commentId,
}: {
  commentId: string;
}) {
  try {
    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    const existing = await db.query.postCommentUpvoteTable.findFirst({
      columns: { id: true },
      where: and(
        eq(postCommentUpvoteTable.commentId, commentId),
        eq(postCommentUpvoteTable.userId, session.userId),
      ),
    });

    if (!existing) {
      return { success: true, alreadyRemoved: true };
    }

    await db
      .delete(postCommentUpvoteTable)
      .where(
        and(
          eq(postCommentUpvoteTable.commentId, commentId),
          eq(postCommentUpvoteTable.userId, session.userId),
        ),
      );

    await db
      .update(postCommentTable)
      .set({
        upvoteCount: sql`CASE WHEN ${postCommentTable.upvoteCount} > 0 THEN ${postCommentTable.upvoteCount} - 1 ELSE 0 END`,
      })
      .where(eq(postCommentTable.id, commentId));

    return { success: true };
  } catch (err) {
    console.log(err);
    return { error: "An error occurred" };
  }
}
