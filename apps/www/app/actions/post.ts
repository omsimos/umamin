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
import { revalidateTag, updateTag } from "next/cache";
import * as z from "zod";
import { getSession } from "@/lib/auth";
import {
  MAX_POST_IMAGES,
  PLUS_REQUIRED_ERROR,
  postImageInputSchema,
} from "@/lib/post-images";
import { checkRateLimit, RATE_LIMIT_ERROR } from "@/lib/ratelimit";
import { redis } from "@/lib/redis";
import { getPostById } from "@/lib/server/data";
import { refreshHotPostRank, removeHotPostRank } from "@/lib/server/feed-rank";
import {
  claimStagedImages,
  deletePostImages,
  isR2Configured,
} from "@/lib/server/r2";
import { formatContent, hasUmaminPlus } from "@/lib/utils";

// Records the newest feed-edge timestamp so the client can show a "new posts"
// pill without polling Turso. No-ops when Redis isn't configured.
async function bumpFeedLatest(createdAt: Date) {
  if (redis) {
    await redis.set("feed:latest", createdAt.getTime());
  }
}

const createPostSchema = z
  .object({
    content: z
      .string()
      .trim()
      .max(500, { error: "Content cannot exceed 500 characters" }),
    images: z.array(postImageInputSchema).max(MAX_POST_IMAGES).optional(),
    // Quote posts: a real post referencing another (soft reference).
    quotedPostId: z.string().min(1).max(50).optional(),
  })
  // Image-only posts are allowed; empty posts are not.
  .refine((v) => v.content.length > 0 || (v.images?.length ?? 0) > 0, {
    error: "Content cannot be empty",
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

    const { content, images, quotedPostId } = params.data;
    const { session, user } = await getSession();

    if (!session || !user) {
      throw new Error("Unauthorized");
    }

    if (!(await checkRateLimit("write", `post:${session.userId}`))) {
      return { error: RATE_LIMIT_ERROR };
    }

    if (quotedPostId) {
      const quoted = await db.query.postTable.findFirst({
        columns: { id: true },
        where: eq(postTable.id, quotedPostId),
      });

      if (!quoted) {
        return { error: "The post you're quoting is no longer available." };
      }
    }

    let claimedImages: Awaited<ReturnType<typeof claimStagedImages>> = null;

    if (images?.length) {
      if (!isR2Configured()) {
        return { error: "Image uploads aren't available right now." };
      }

      // Re-checked server-side: the composer gate is UX-only.
      if (!hasUmaminPlus(user.createdAt)) {
        return { error: PLUS_REQUIRED_ERROR };
      }

      claimedImages = await claimStagedImages(session.userId, images);

      if (!claimedImages) {
        return { error: "Couldn't attach images. Please try again." };
      }
    }

    const formattedContent = formatContent(content);

    let createdPost: typeof postTable.$inferSelect;

    try {
      createdPost = await db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(postTable)
          .values({
            content: formattedContent,
            authorId: session.userId,
            images: claimedImages,
            quotedPostId: quotedPostId ?? null,
          })
          .returning();

        // A quote counts toward the quoted post's combined repost count, in
        // the same transaction so the count can't drift from the row.
        if (quotedPostId) {
          await tx
            .update(postTable)
            .set({
              repostCount: sql`${postTable.repostCount} + 1`,
            })
            .where(eq(postTable.id, quotedPostId));
        }

        return inserted;
      });
    } catch (err) {
      // Claimed objects must not outlive a failed insert (storage leak).
      await deletePostImages(claimedImages);
      throw err;
    }

    // Background SWR, not updateTag: expiring "posts" forces a blocking re-scan
    // of the (Hot-ranked) feed, which times out on large datasets. The poster
    // sees their post via the optimistic prepend; the feed refreshes async.
    revalidateTag("posts", "max");
    updateTag(`user-posts:${session.userId}`);
    await refreshHotPostRank(createdPost.id);
    if (quotedPostId) {
      // Mirror addRepostAction: refresh the quoted post's card + rank; the
      // feed shows its bumped count eventually (<=120s), same as likes.
      updateTag(`post:${quotedPostId}`);
      await refreshHotPostRank(quotedPostId);
    }
    await bumpFeedLatest(createdPost.createdAt);

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
      columns: { id: true, authorId: true, images: true, quotedPostId: true },
      where: eq(postTable.id, postId),
    });

    if (!post || post.authorId !== session.userId) {
      return { error: "Post not found" };
    }

    await db.transaction(async (tx) => {
      await tx.delete(postTable).where(eq(postTable.id, postId));

      // Inverse of the quote bump in createPostAction; guarded against
      // underflow, no-op when the quoted post is already gone.
      if (post.quotedPostId) {
        await tx
          .update(postTable)
          .set({
            repostCount: sql`CASE WHEN ${postTable.repostCount} > 0 THEN ${postTable.repostCount} - 1 ELSE 0 END`,
          })
          .where(eq(postTable.id, post.quotedPostId));
      }
    });

    // Best-effort: an orphaned R2 object costs fractions of a cent; the post
    // row (already gone) is the source of truth.
    await deletePostImages(post.images);

    // SWR like createPostAction — avoid the blocking full feed re-scan.
    revalidateTag("posts", "max");
    await removeHotPostRank(postId);
    updateTag(`user-posts:${session.userId}`);
    updateTag(`post:${postId}`);
    updateTag(`post-comments:${postId}`);
    updateTag(`post:${postId}:liked:${session.userId}`);
    updateTag(`post:${postId}:reposted:${session.userId}`);
    if (post.quotedPostId) {
      updateTag(`post:${post.quotedPostId}`);
      await refreshHotPostRank(post.quotedPostId);
    }

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
    await refreshHotPostRank(postId);

    return { success: true, comment: createdComment };
  } catch (err) {
    console.log(err);
    return { error: "An error occurred" };
  }
}

const idSchema = z.string().min(1);

export async function deleteCommentAction({
  commentId,
}: {
  commentId: string;
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

    if (!(await checkRateLimit("write", `delcomment:${session.userId}`))) {
      return { error: RATE_LIMIT_ERROR };
    }

    // Resolve + authorize server-side (don't trust a client-supplied postId).
    const comment = await db.query.postCommentTable.findFirst({
      columns: { id: true, authorId: true, postId: true },
      where: eq(postCommentTable.id, commentId),
    });

    if (!comment || comment.authorId !== session.userId) {
      return { error: "Comment not found" };
    }

    await db.transaction(async (tx) => {
      // The comment's own likes cascade via FK (post_comment_like → comment).
      const removed = await tx
        .delete(postCommentTable)
        .where(eq(postCommentTable.id, commentId))
        .returning({ id: postCommentTable.id });

      if (removed.length === 0) {
        return;
      }

      // Inverse of createCommentAction's increment; guarded against underflow.
      await tx
        .update(postTable)
        .set({
          commentCount: sql`CASE WHEN ${postTable.commentCount} > 0 THEN ${postTable.commentCount} - 1 ELSE 0 END`,
        })
        .where(eq(postTable.id, comment.postId));
    });

    // Mirror createCommentAction: refresh the single post + its thread, leave
    // the feed's commentCount eventually-consistent (<=120s).
    updateTag(`post:${comment.postId}`);
    updateTag(`post-comments:${comment.postId}`);
    await refreshHotPostRank(comment.postId);

    return { success: true, postId: comment.postId };
  } catch (err) {
    console.log(err);
    return { error: "An error occurred" };
  }
}

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
      const inserted = await tx
        .insert(postLikeTable)
        .values({
          postId,
          userId: session.userId,
        })
        .onConflictDoNothing()
        .returning({ id: postLikeTable.id });

      if (inserted.length === 0) {
        return { success: true, alreadyLiked: true };
      }

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
    if (!("alreadyLiked" in result)) {
      await refreshHotPostRank(postId);
    }
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
      const removed = await tx
        .delete(postLikeTable)
        .where(
          and(
            eq(postLikeTable.postId, postId),
            eq(postLikeTable.userId, session.userId),
          ),
        )
        .returning({ id: postLikeTable.id });

      if (removed.length === 0) {
        return { success: true, alreadyRemoved: true };
      }

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
    if (!("alreadyRemoved" in result)) {
      await refreshHotPostRank(postId);
    }

    return result;
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
      const inserted = await tx
        .insert(postCommentLikeTable)
        .values({
          commentId,
          userId: session.userId,
        })
        .onConflictDoNothing()
        .returning({ id: postCommentLikeTable.id });

      if (inserted.length === 0) {
        return { success: true, alreadyLiked: true };
      }

      await tx
        .update(postCommentTable)
        .set({
          likeCount: sql`${postCommentTable.likeCount} + 1`,
        })
        .where(eq(postCommentTable.id, commentId));

      return { success: true };
    });

    // A comment like only changes the per-viewer liked flag (the tag below,
    // overlaid fresh by getCommentViewerOverlay) and an eventually-consistent
    // likeCount. So don't bust the shared post-comments cache (re-scans every
    // comment + author join for all viewers), and the bare comment:<id> tag was
    // dead — no matching cacheTag exists. [audit #13, #18]
    updateTag(`comment:${commentId}:liked:${session.userId}`);
    return result;
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
      const removed = await tx
        .delete(postCommentLikeTable)
        .where(
          and(
            eq(postCommentLikeTable.commentId, commentId),
            eq(postCommentLikeTable.userId, session.userId),
          ),
        )
        .returning({ id: postCommentLikeTable.id });

      if (removed.length === 0) {
        return { success: true, alreadyRemoved: true };
      }

      await tx
        .update(postCommentTable)
        .set({
          likeCount: sql`CASE WHEN ${postCommentTable.likeCount} > 0 THEN ${postCommentTable.likeCount} - 1 ELSE 0 END`,
        })
        .where(eq(postCommentTable.id, commentId));

      return { success: true };
    });

    // A comment like only changes the per-viewer liked flag (the tag below,
    // overlaid fresh by getCommentViewerOverlay) and an eventually-consistent
    // likeCount. So don't bust the shared post-comments cache (re-scans every
    // comment + author join for all viewers), and the bare comment:<id> tag was
    // dead — no matching cacheTag exists. [audit #13, #18]
    updateTag(`comment:${commentId}:liked:${session.userId}`);
    return result;
  } catch (err) {
    console.log(err);
    return { error: "An error occurred" };
  }
}

// Plain reposts only — quotes go through createPostAction with quotedPostId.
const createRepostSchema = z.object({
  postId: z.string(),
});

export async function addRepostAction(
  values: z.infer<typeof createRepostSchema>,
) {
  try {
    const params = createRepostSchema.safeParse(values);

    if (!params.success) {
      return { error: "Invalid input" };
    }

    const { postId } = params.data;
    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    if (!(await checkRateLimit("write", `repost:${session.userId}`))) {
      return { error: RATE_LIMIT_ERROR };
    }

    const result = await db.transaction(async (tx) => {
      const [repost] = await tx
        .insert(postRepostTable)
        .values({
          postId,
          userId: session.userId,
        })
        .onConflictDoNothing()
        .returning();

      if (!repost) {
        return { success: true, alreadyReposted: true };
      }

      await tx
        .update(postTable)
        .set({
          repostCount: sql`${postTable.repostCount} + 1`,
        })
        .where(eq(postTable.id, postId));

      return { success: true, repost };
    });

    updateTag(`post:${postId}`);
    // Intentionally NOT invalidating the global "posts" feed tag: a full feed
    // recompute (union + inArray lookups) on every repost is the exact Turso
    // cost the like path avoids. The new edge surfaces via the 120s revalidate
    // + the feed:latest "new posts" pill (bumped below); the actor's own state
    // is kept fresh by the per-viewer reposted tag + syncRepostCache.
    updateTag(`post:${postId}:reposted:${session.userId}`);
    if (!("alreadyReposted" in result)) {
      await refreshHotPostRank(postId);
    }
    if ("repost" in result && result.repost) {
      await bumpFeedLatest(result.repost.createdAt);
    }
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
      const removed = await tx
        .delete(postRepostTable)
        .where(
          and(
            eq(postRepostTable.postId, postId),
            eq(postRepostTable.userId, session.userId),
          ),
        )
        .returning({ id: postRepostTable.id });

      if (removed.length === 0) {
        return { success: true, alreadyRemoved: true };
      }

      await tx
        .update(postTable)
        .set({
          repostCount: sql`CASE WHEN ${postTable.repostCount} > 0 THEN ${postTable.repostCount} - 1 ELSE 0 END`,
        })
        .where(eq(postTable.id, postId));

      return { success: true };
    });

    updateTag(`post:${postId}`);
    // See addRepostAction: skip the global "posts" recompute; the removed edge
    // ages out via the 120s revalidate, and the per-viewer tag stays fresh.
    updateTag(`post:${postId}:reposted:${session.userId}`);
    if (!("alreadyRemoved" in result)) {
      await refreshHotPostRank(postId);
    }
    return result;
  } catch (err) {
    console.log(err);
    return { error: "An error occurred" };
  }
}
