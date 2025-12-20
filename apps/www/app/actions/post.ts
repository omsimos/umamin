"use server";

import { db } from "@umamin/db";
import {
  postCommentLikeTable,
  postCommentTable,
  postLikeTable,
  postRepostTable,
  postTable,
} from "@umamin/db/schema/post";
import { userBlockTable } from "@umamin/db/schema/user";
import { and, eq, exists, or, sql } from "drizzle-orm";
import { cacheLife, cacheTag, updateTag } from "next/cache";
import * as z from "zod";
import { getSession } from "@/lib/auth";

const createPostSchema = z.object({
  content: z
    .string()
    .min(1, { error: "Content cannot be empty" })
    .max(500, { error: "Content cannot exceed 500 characters" }),
});

export async function getPostAction(id: string) {
  const res = await (async () => {
    "use cache: private";
    cacheTag(`post:${id}`);
    cacheLife({ revalidate: 30 });

    return db.query.postTable.findFirst({
      with: {
        author: true,
      },
      where: eq(postTable.id, id),
    });
  })();

  if (!res) return res;

  const { session } = await getSession();

  if (!session) return res;

  const isBlocked = await (async () => {
    "use cache: private";
    cacheTag(`user-blocks:${session.userId}`);
    cacheLife({ revalidate: 30 });

    const blocked = await db
      .select({
        blocked: exists(
          db
            .select({ id: userBlockTable.id })
            .from(userBlockTable)
            .where(
              or(
                and(
                  eq(userBlockTable.blockerId, session.userId),
                  eq(userBlockTable.blockedId, res.authorId),
                ),
                and(
                  eq(userBlockTable.blockerId, res.authorId),
                  eq(userBlockTable.blockedId, session.userId),
                ),
              ),
            ),
        ),
      })
      .from(postTable)
      .where(eq(postTable.id, id))
      .limit(1);

    return Boolean(blocked?.[0]?.blocked);
  })();

  if (isBlocked) return null;

  const isLiked = await (async () => {
    "use cache: private";
    cacheTag(`post:${id}:liked:${session.userId}`);
    cacheLife({ revalidate: 30 });

    const liked = await db
      .select({
        liked: exists(
          db
            .select({ id: postLikeTable.id })
            .from(postLikeTable)
            .where(
              and(
                eq(postLikeTable.postId, id),
                eq(postLikeTable.userId, session.userId),
              ),
            ),
        ),
      })
      .from(postTable)
      .where(eq(postTable.id, id))
      .limit(1);

    return Boolean(liked?.[0]?.liked);
  })();

  const isReposted = await (async () => {
    "use cache: private";
    cacheTag(`post:${id}:reposted:${session.userId}`);
    cacheLife({ revalidate: 30 });

    const reposted = await db
      .select({
        reposted: exists(
          db
            .select({ id: postRepostTable.id })
            .from(postRepostTable)
            .where(
              and(
                eq(postRepostTable.postId, id),
                eq(postRepostTable.userId, session.userId),
              ),
            ),
        ),
      })
      .from(postTable)
      .where(eq(postTable.id, id))
      .limit(1);

    return Boolean(reposted?.[0]?.reposted);
  })();

  return { ...res, isLiked, isReposted };
}

export async function getPostPublicAction(id: string) {
  const res = await (async () => {
    "use cache";
    cacheTag(`post:${id}`);
    cacheLife({ revalidate: 30 });

    return db.query.postTable.findFirst({
      with: {
        author: true,
      },
      where: eq(postTable.id, id),
    });
  })();

  return res ?? null;
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

export async function deletePostAction({ postId }: { postId: string }) {
  try {
    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    const post = await db.query.postTable.findFirst({
      columns: { id: true, authorId: true },
      where: eq(postTable.id, postId),
    });

    if (!post) {
      return { error: "Post not found" };
    }

    if (post.authorId !== session.userId) {
      throw new Error("Unauthorized");
    }

    await db.delete(postTable).where(eq(postTable.id, postId));

    updateTag("posts");
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

    await db.transaction(async (tx) => {
      await tx.insert(postCommentTable).values({
        postId,
        content,
        authorId: session.userId,
      });

      await tx
        .update(postTable)
        .set({
          commentCount: sql`${postTable.commentCount} + 1`,
        })
        .where(eq(postTable.id, postId));
    });

    updateTag(`post:${postId}`);
    updateTag("posts");
    updateTag(`post-comments:${postId}`);

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
    updateTag("posts");
    updateTag(`post:${postId}:liked:${session.userId}`);
    return result;
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
    updateTag("posts");
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
    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
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

    updateTag("posts");
    updateTag(`comment:${commentId}`);
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
    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
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

    updateTag("posts");
    updateTag(`comment:${commentId}`);
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

      await tx.insert(postRepostTable).values({
        postId,
        userId: session.userId,
        content: content?.trim() ? content.trim() : null,
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
    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
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
