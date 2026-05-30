"use server";

import { db } from "@umamin/db";
import {
  postCommentLikeTable,
  postCommentTable,
  postLikeTable,
  postRepostTable,
  postTable,
} from "@umamin/db/schema/post";
import { and, eq, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import * as z from "zod";
import { getSession } from "@/lib/auth";
import { checkRateLimit, RATE_LIMIT_ERROR } from "@/lib/ratelimit";
import { getPostById } from "@/lib/server/data";
import { formatContent } from "@/lib/utils";

const createPostSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, { error: "Content cannot be empty" })
    .max(500, { error: "Content cannot exceed 500 characters" }),
});

export async function getPostAction(id: string) {
  const { session } = await getSession();
  return getPostById({ postId: id, viewerId: session?.userId });
}

export async function getPostPublicAction(id: string) {
  return getPostById({ postId: id });
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

    if (!(await checkRateLimit("write", `post:${session.userId}`))) {
      return { error: RATE_LIMIT_ERROR };
    }

    const formattedContent = formatContent(content);

    const [createdPost] = await db
      .insert(postTable)
      .values({
        content: formattedContent,
        authorId: session.userId,
      })
      .returning();

    updateTag("posts");
    updateTag(`user-posts:${session.userId}`);

    return {
      success: true,
      post: createdPost,
    };
  } catch (err) {
    console.log(err);
    return { error: "An error occurred" };
  }
}

export async function deletePostAction({ postId }: { postId: string }) {
  try {
    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    if (!(await checkRateLimit("write", `delpost:${session.userId}`))) {
      return { error: RATE_LIMIT_ERROR };
    }

    const post = await db.query.postTable.findFirst({
      columns: { id: true, authorId: true },
      where: eq(postTable.id, postId),
    });

    if (!post || post.authorId !== session.userId) {
      return { error: "Post not found" };
    }

    await db.delete(postTable).where(eq(postTable.id, postId));

    updateTag("posts");
    updateTag(`user-posts:${session.userId}`);
    updateTag(`post:${postId}`);
    updateTag(`post-comments:${postId}`);
    updateTag(`post:${postId}:liked:${session.userId}`);
    updateTag(`post:${postId}:reposted:${session.userId}`);

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
    .trim()
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

    if (!(await checkRateLimit("write", `comment:${session.userId}`))) {
      return { error: RATE_LIMIT_ERROR };
    }

    let createdComment: typeof postCommentTable.$inferSelect | undefined;

    await db.transaction(async (tx) => {
      const [comment] = await tx
        .insert(postCommentTable)
        .values({
          postId,
          content: formatContent(content),
          authorId: session.userId,
        })
        .returning();

      createdComment = comment;

      await tx
        .update(postTable)
        .set({
          commentCount: sql`${postTable.commentCount} + 1`,
        })
        .where(eq(postTable.id, postId));
    });

    // Note: not invalidating the "posts" feed tag — a new comment only bumps
    // commentCount, which the feed shows as eventually consistent (<=120s),
    // matching the like-count behavior. The single-post + comment-thread tags
    // below refresh immediately. Avoids a full feed re-scan on every comment.
    updateTag(`post:${postId}`);
    updateTag(`post-comments:${postId}`);

    return { success: true, comment: createdComment };
  } catch (err) {
    console.log(err);
    return { error: "An error occurred" };
  }
}

const idSchema = z.string().min(1);

export async function addLikeAction({ postId }: { postId: string }) {
  try {
    const parsed = idSchema.safeParse(postId);
    if (!parsed.success) {
      return { error: "Invalid input" };
    }
    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    if (!(await checkRateLimit("write", `like:${session.userId}`))) {
      return { error: RATE_LIMIT_ERROR };
    }

    const result = await db.transaction(async (tx) => {
      const existing = await tx.query.postLikeTable.findFirst({
        columns: { id: true },
        where: and(
          eq(postLikeTable.postId, postId),
          eq(postLikeTable.userId, session.userId),
        ),
      });

      if (existing) {
        return { success: true, alreadyLiked: true };
      }

      await tx
        .insert(postLikeTable)
        .values({
          postId,
          userId: session.userId,
        })
        .onConflictDoNothing();

      await tx
        .update(postTable)
        .set({
          likeCount: sql`${postTable.likeCount} + 1`,
        })
        .where(eq(postTable.id, postId));

      return { success: true };
    });

    updateTag(`post:${postId}`);
    // Note: intentionally not invalidating the "posts" feed tag here. A like
    // only changes likeCount, which the public feed shows as eventually
    // consistent (<=120s). The per-viewer liked tag below keeps the viewer's
    // own like state fresh. This avoids a full feed-cache miss on every like.
    updateTag(`post:${postId}:liked:${session.userId}`);
    return result;
  } catch (err) {
    console.log(err);
    return { error: "An error occurred" };
  }
}

export async function removeLikeAction({ postId }: { postId: string }) {
  try {
    const parsed = idSchema.safeParse(postId);
    if (!parsed.success) {
      return { error: "Invalid input" };
    }
    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    if (!(await checkRateLimit("write", `like:${session.userId}`))) {
      return { error: RATE_LIMIT_ERROR };
    }

    const result = await db.transaction(async (tx) => {
      const existing = await tx.query.postLikeTable.findFirst({
        columns: { id: true },
        where: and(
          eq(postLikeTable.postId, postId),
          eq(postLikeTable.userId, session.userId),
        ),
      });

      if (!existing) {
        return { success: true, alreadyRemoved: true };
      }

      await tx
        .delete(postLikeTable)
        .where(
          and(
            eq(postLikeTable.postId, postId),
            eq(postLikeTable.userId, session.userId),
          ),
        );

      await tx
        .update(postTable)
        .set({
          likeCount: sql`CASE WHEN ${postTable.likeCount} > 0 THEN ${postTable.likeCount} - 1 ELSE 0 END`,
        })
        .where(eq(postTable.id, postId));

      return { success: true };
    });

    updateTag(`post:${postId}`);
    // See addLikeAction: skip the "posts" feed tag; likeCount is eventually
    // consistent in the feed, and the per-viewer tag below stays fresh.
    updateTag(`post:${postId}:liked:${session.userId}`);

    return result;
  } catch (err) {
    console.log(err);
    return { error: "An error occurred" };
  }
}

export async function addCommentLikeAction({
  commentId,
  postId,
}: {
  commentId: string;
  postId?: string;
}) {
  try {
    const parsed = idSchema.safeParse(commentId);
    if (!parsed.success) {
      return { error: "Invalid input" };
    }
    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    if (!(await checkRateLimit("write", `commentlike:${session.userId}`))) {
      return { error: RATE_LIMIT_ERROR };
    }

    const result = await db.transaction(async (tx) => {
      const existing = await tx.query.postCommentLikeTable.findFirst({
        columns: { id: true },
        where: and(
          eq(postCommentLikeTable.commentId, commentId),
          eq(postCommentLikeTable.userId, session.userId),
        ),
      });

      if (existing) {
        return { success: true, alreadyLiked: true };
      }

      await tx
        .insert(postCommentLikeTable)
        .values({
          commentId,
          userId: session.userId,
        })
        .onConflictDoNothing();

      await tx
        .update(postCommentTable)
        .set({
          likeCount: sql`${postCommentTable.likeCount} + 1`,
        })
        .where(eq(postCommentTable.id, commentId));

      return { success: true };
    });

    // Comment likes don't appear in the feed, so no "posts" invalidation.
    updateTag(`comment:${commentId}`);
    updateTag(`comment:${commentId}:liked:${session.userId}`);
    if (postId) {
      updateTag(`post-comments:${postId}`);
    }
    return result;
  } catch (err) {
    console.log(err);
    return { error: "An error occurred" };
  }
}

export async function removeCommentLikeAction({
  commentId,
  postId,
}: {
  commentId: string;
  postId?: string;
}) {
  try {
    const parsed = idSchema.safeParse(commentId);
    if (!parsed.success) {
      return { error: "Invalid input" };
    }
    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    if (!(await checkRateLimit("write", `commentlike:${session.userId}`))) {
      return { error: RATE_LIMIT_ERROR };
    }

    const result = await db.transaction(async (tx) => {
      const existing = await tx.query.postCommentLikeTable.findFirst({
        columns: { id: true },
        where: and(
          eq(postCommentLikeTable.commentId, commentId),
          eq(postCommentLikeTable.userId, session.userId),
        ),
      });

      if (!existing) {
        return { success: true, alreadyRemoved: true };
      }

      await tx
        .delete(postCommentLikeTable)
        .where(
          and(
            eq(postCommentLikeTable.commentId, commentId),
            eq(postCommentLikeTable.userId, session.userId),
          ),
        );

      await tx
        .update(postCommentTable)
        .set({
          likeCount: sql`CASE WHEN ${postCommentTable.likeCount} > 0 THEN ${postCommentTable.likeCount} - 1 ELSE 0 END`,
        })
        .where(eq(postCommentTable.id, commentId));

      return { success: true };
    });

    // Comment likes don't appear in the feed, so no "posts" invalidation.
    updateTag(`comment:${commentId}`);
    updateTag(`comment:${commentId}:liked:${session.userId}`);
    if (postId) {
      updateTag(`post-comments:${postId}`);
    }
    return result;
  } catch (err) {
    console.log(err);
    return { error: "An error occurred" };
  }
}

const createRepostSchema = z.object({
  postId: z.string(),
  content: z
    .string()
    .trim()
    .max(500, { error: "Content cannot exceed 500 characters" })
    .optional()
    .or(z.literal("")),
});

export async function addRepostAction(
  values: z.infer<typeof createRepostSchema>,
) {
  try {
    const params = createRepostSchema.safeParse(values);

    if (!params.success) {
      return { error: "Invalid input" };
    }

    const { postId, content } = params.data;
    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    if (!(await checkRateLimit("write", `repost:${session.userId}`))) {
      return { error: RATE_LIMIT_ERROR };
    }

    const result = await db.transaction(async (tx) => {
      const existing = await tx.query.postRepostTable.findFirst({
        columns: { id: true },
        where: and(
          eq(postRepostTable.postId, postId),
          eq(postRepostTable.userId, session.userId),
        ),
      });

      if (existing) {
        return { success: true, alreadyReposted: true };
      }

      const formatted = content?.trim() ? formatContent(content) : null;

      await tx.insert(postRepostTable).values({
        postId,
        userId: session.userId,
        content: formatted,
      });

      await tx
        .update(postTable)
        .set({
          repostCount: sql`${postTable.repostCount} + 1`,
        })
        .where(eq(postTable.id, postId));

      return { success: true };
    });

    updateTag(`post:${postId}`);
    updateTag("posts");
    updateTag(`post:${postId}:reposted:${session.userId}`);
    return result;
  } catch (err) {
    console.log(err);
    return { error: "An error occurred" };
  }
}

export async function removeRepostAction({ postId }: { postId: string }) {
  try {
    const parsed = idSchema.safeParse(postId);
    if (!parsed.success) {
      return { error: "Invalid input" };
    }
    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    if (!(await checkRateLimit("write", `repost:${session.userId}`))) {
      return { error: RATE_LIMIT_ERROR };
    }

    const result = await db.transaction(async (tx) => {
      const existing = await tx.query.postRepostTable.findFirst({
        columns: { id: true },
        where: and(
          eq(postRepostTable.postId, postId),
          eq(postRepostTable.userId, session.userId),
        ),
      });

      if (!existing) {
        return { success: true, alreadyRemoved: true };
      }

      await tx
        .delete(postRepostTable)
        .where(
          and(
            eq(postRepostTable.postId, postId),
            eq(postRepostTable.userId, session.userId),
          ),
        );

      await tx
        .update(postTable)
        .set({
          repostCount: sql`CASE WHEN ${postTable.repostCount} > 0 THEN ${postTable.repostCount} - 1 ELSE 0 END`,
        })
        .where(eq(postTable.id, postId));

      return { success: true };
    });

    updateTag(`post:${postId}`);
    updateTag("posts");
    updateTag(`post:${postId}:reposted:${session.userId}`);
    return result;
  } catch (err) {
    console.log(err);
    return { error: "An error occurred" };
  }
}
