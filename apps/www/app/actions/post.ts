"use server";

import { db } from "@umamin/db";
import {
  postCommentTable,
  postTable,
  postUpvoteTable,
} from "@umamin/db/schema/post";
import { eq, sql } from "drizzle-orm";
import { cacheTag, updateTag } from "next/cache";
import * as z from "zod";
import { getSession } from "@/lib/auth";

const createPostSchema = z.object({
  content: z
    .string()
    .min(1, { error: "Content cannot be empty" })
    .max(500, { error: "Content cannot exceed 500 characters" }),
});

export async function getPostAction(id: string) {
  "use cache";
  cacheTag(`post:${id}`);

  const res = await db.query.postTable.findFirst({
    with: {
      author: true,
      comments: {
        with: {
          author: true,
        },
      },
    },
    where: eq(postTable.id, id),
  });
  return res;
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

    try {
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
    } catch {}
    return { success: true };
  } catch (err) {
    console.log(err);
    return { error: "An error occurred" };
  }
}
