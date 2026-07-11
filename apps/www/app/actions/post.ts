"use server";

import { db } from "@umamin/db";
import {
  pollOptionTable,
  pollVoteTable,
  postCommentLikeTable,
  postCommentTable,
  postLikeTable,
  postRepostTable,
  postTable,
} from "@umamin/db/schema/post";
import { userTable } from "@umamin/db/schema/user";
import { and, eq, ne, sql } from "drizzle-orm";
import { revalidateTag, updateTag } from "next/cache";
import * as z from "zod";
import { getSession } from "@/lib/auth";
import { AURA_POINTS, awardAura, reverseAura } from "@/lib/points";
import {
  POLL_DURATIONS,
  POLL_ENDED_ERROR,
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  POLL_OPTION_MAX_LENGTH,
  POLL_PLUS_REQUIRED_ERROR,
  pollEndsAtFrom,
  sanitizePollOptions,
} from "@/lib/poll";
import {
  hasImagePostingAura,
  IMAGE_AURA_REQUIRED_ERROR,
  MAX_POST_IMAGES,
  postImageInputSchema,
} from "@/lib/post-images";
import { idSchema } from "@/lib/schema";
import { getPostById } from "@/lib/server/data";
import { refreshHotPostRank, removeHotPostRank } from "@/lib/server/feed-rank";
import { isModerator } from "@/lib/server/moderation";
import { notify } from "@/lib/server/notifications";
import {
  claimStagedImages,
  deletePostImages,
  isR2Configured,
} from "@/lib/server/r2";
import { withAction } from "@/lib/server/with-action";
import { formatContent, hasUmaminPlus } from "@/lib/utils";

const createPostSchema = z
  .object({
    content: z
      .string()
      .trim()
      .max(500, { error: "Content cannot exceed 500 characters" }),
    images: z.array(postImageInputSchema).max(MAX_POST_IMAGES).optional(),
    // Quote posts: a real post referencing another (soft reference).
    quotedPostId: z.string().min(1).max(50).optional(),
    poll: z
      .object({
        options: z
          .array(z.string().trim().min(1).max(POLL_OPTION_MAX_LENGTH))
          .min(POLL_MIN_OPTIONS)
          .max(POLL_MAX_OPTIONS),
        duration: z.enum(POLL_DURATIONS),
      })
      .optional(),
  })
  // Image-only posts are allowed; empty posts are not.
  .refine((v) => v.content.length > 0 || (v.images?.length ?? 0) > 0, {
    error: "Content cannot be empty",
  })
  // The post text is the poll's question — a poll can't stand alone, and it
  // never coexists with images (one attachment kind per post).
  .refine((v) => !v.poll || v.content.length > 0, {
    error: "A poll needs a question",
  })
  .refine((v) => !(v.poll && (v.images?.length ?? 0) > 0), {
    error: "A post can have a poll or images, not both",
  });

export async function getPostAction(id: string) {
  const { session } = await getSession();
  return getPostById({ postId: id, viewerId: session?.userId });
}

export async function getPostPublicAction(id: string) {
  return getPostById({ postId: id });
}

export const createPostAction = withAction(
  {
    schema: createPostSchema,
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `post:${session.userId}`,
    },
  },
  async ({ content, images, quotedPostId, poll }, { session, user }) => {
    // Independent of the image gate below (which only runs when images are
    // attached) — a poll-only post must be re-checked server-side too.
    let pollLabels: string[] | null = null;
    if (poll) {
      if (!hasUmaminPlus(user.createdAt)) {
        return { error: POLL_PLUS_REQUIRED_ERROR };
      }

      pollLabels = sanitizePollOptions(poll.options);
      if (pollLabels.length < POLL_MIN_OPTIONS) {
        return { error: "A poll needs at least 2 distinct options" };
      }
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
      if (!hasImagePostingAura(user.points)) {
        return { error: IMAGE_AURA_REQUIRED_ERROR };
      }

      claimedImages = await claimStagedImages(session.userId, images);

      if (!claimedImages) {
        return { error: "Couldn't attach images. Please try again." };
      }
    }

    const formattedContent = formatContent(content);

    let createdPost: typeof postTable.$inferSelect;
    let createdPollOptions: (typeof pollOptionTable.$inferSelect)[] = [];
    let quoteAuraUsername: string | null = null;

    try {
      const created = await db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(postTable)
          .values({
            content: formattedContent,
            authorId: session.userId,
            images: claimedImages,
            quotedPostId: quotedPostId ?? null,
            pollEndsAt:
              poll && pollLabels ? pollEndsAtFrom(poll.duration) : null,
          })
          .returning();

        // Option ids must come back from the insert — the client needs them
        // to make the optimistic post votable after the server swap.
        const insertedOptions =
          poll && pollLabels
            ? await tx
                .insert(pollOptionTable)
                .values(
                  pollLabels.map((label, idx) => ({
                    postId: inserted.id,
                    idx,
                    label,
                  })),
                )
                .returning()
            : [];

        // A quote counts toward the quoted post's combined repost count, in
        // the same transaction so the count can't drift from the row.
        if (quotedPostId) {
          const [bumped] = await tx
            .update(postTable)
            .set({
              repostCount: sql`${postTable.repostCount} + 1`,
            })
            .where(eq(postTable.id, quotedPostId))
            .returning({ authorId: postTable.authorId });

          if (bumped) {
            quoteAuraUsername = await awardAura(tx, {
              beneficiaryId: bumped.authorId,
              actorId: session.userId,
              actorCreatedAt: user.createdAt,
              delta: AURA_POINTS.quote,
            });
          }
        }

        return { post: inserted, pollOptions: insertedOptions };
      });
      createdPost = created.post;
      createdPollOptions = created.pollOptions;
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
    if (quoteAuraUsername) {
      updateTag(`user:${quoteAuraUsername}`);
    }

    return {
      success: true,
      post: createdPost,
      poll:
        createdPost.pollEndsAt && createdPollOptions.length > 0
          ? {
              endsAt: createdPost.pollEndsAt,
              options: createdPollOptions.map((option) => ({
                id: option.id,
                idx: option.idx,
                label: option.label,
                voteCount: option.voteCount,
              })),
            }
          : null,
    };
  },
);

export const deletePostAction = withAction(
  {
    schema: z.object({ postId: idSchema }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `delpost:${session.userId}`,
    },
  },
  async ({ postId }, { session, user }) => {
    const post = await db.query.postTable.findFirst({
      columns: { id: true, authorId: true, images: true, quotedPostId: true },
      where: eq(postTable.id, postId),
    });

    // A maintainer can remove anyone's post; owners still delete their own.
    const isOwner = !!post && post.authorId === session.userId;
    const isMod = isModerator(user);

    if (!post || (!isOwner && !isMod)) {
      return { error: "Post not found" };
    }

    // Owner-scoped side effects key on the CONTENT owner, not the actor — so a
    // mod removal purges the right user's profile/pin caches.
    const ownerId = post.authorId;
    let quoteAuraUsername: string | null = null;

    await db.transaction(async (tx) => {
      await tx.delete(postTable).where(eq(postTable.id, postId));

      // Inverse of the quote bump in createPostAction; guarded against
      // underflow, no-op when the quoted post is already gone.
      if (post.quotedPostId) {
        const [bumped] = await tx
          .update(postTable)
          .set({
            repostCount: sql`CASE WHEN ${postTable.repostCount} > 0 THEN ${postTable.repostCount} - 1 ELSE 0 END`,
          })
          .where(eq(postTable.id, post.quotedPostId))
          .returning({ authorId: postTable.authorId });

        if (bumped) {
          // The aura actor is the quote's author, not the deleter. On a mod
          // removal we lack the author's account age, so we pass undefined —
          // reverseAura then no-ops (conservative: never drains points it can't
          // confirm were awarded). Owner deletes keep the exact prior behavior.
          quoteAuraUsername = await reverseAura(tx, {
            beneficiaryId: bumped.authorId,
            actorId: ownerId,
            actorCreatedAt: isOwner ? user?.createdAt : undefined,
            delta: AURA_POINTS.quote,
          });
        }
      }

      // Deleting the pinned post unpins it (soft reference — no FK cascade).
      await tx
        .update(userTable)
        .set({ pinnedPostId: null })
        .where(
          and(eq(userTable.id, ownerId), eq(userTable.pinnedPostId, postId)),
        );
    });

    // Best-effort: an orphaned R2 object costs fractions of a cent; the post
    // row (already gone) is the source of truth.
    await deletePostImages(post.images);

    // SWR like createPostAction — avoid the blocking full feed re-scan.
    revalidateTag("posts", "max");
    await removeHotPostRank(postId);
    updateTag(`user-posts:${ownerId}`);
    updateTag(`post:${postId}`);
    updateTag(`post-comments:${postId}`);
    // Per-viewer overlays — bust the actor's own read-your-writes; the post is
    // already globally gone via the post/posts tags above.
    updateTag(`post:${postId}:liked:${session.userId}`);
    updateTag(`post:${postId}:reposted:${session.userId}`);
    updateTag(`post:${postId}:poll-voted:${session.userId}`);
    // Covers the pin-clear above: /api/me carries pinnedPostId for menu state.
    updateTag(`user:${ownerId}`);
    if (post.quotedPostId) {
      updateTag(`post:${post.quotedPostId}`);
      await refreshHotPostRank(post.quotedPostId);
    }
    if (quoteAuraUsername) {
      updateTag(`user:${quoteAuraUsername}`);
    }

    return { success: true };
  },
);

const createCommentSchema = z.object({
  postId: z.string(),
  content: z
    .string()
    .trim()
    .min(1, { error: "Content cannot be empty" })
    .max(500, { error: "Content cannot exceed 500 characters" }),
});

export const createCommentAction = withAction(
  {
    schema: createCommentSchema,
    rateLimit: {
      name: "write",
      key: ({ session }) => `comment:${session.userId}`,
    },
  },
  async ({ content, postId }, { session, user }) => {
    let createdComment: typeof postCommentTable.$inferSelect | undefined;
    let postAuthorId: string | undefined;
    let auraUsername: string | null = null;

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

      // .returning() hands the notification its recipient for free.
      const [updated] = await tx
        .update(postTable)
        .set({
          commentCount: sql`${postTable.commentCount} + 1`,
        })
        .where(eq(postTable.id, postId))
        .returning({ authorId: postTable.authorId });

      postAuthorId = updated?.authorId;

      // First-comment-per-post only: post_comment has no (post,user) UNIQUE, so
      // award the +5 once per (post, commenter) to keep it unfarmable.
      if (updated?.authorId && comment) {
        const prior = await tx
          .select({ id: postCommentTable.id })
          .from(postCommentTable)
          .where(
            and(
              eq(postCommentTable.authorId, session.userId),
              eq(postCommentTable.postId, postId),
              ne(postCommentTable.id, comment.id),
            ),
          )
          .limit(1);

        if (prior.length === 0) {
          auraUsername = await awardAura(tx, {
            beneficiaryId: updated.authorId,
            actorId: session.userId,
            actorCreatedAt: user?.createdAt,
            delta: AURA_POINTS.comment,
          });
        }
      }
    });

    // Note: not invalidating the "posts" feed tag — a new comment only bumps
    // commentCount, which the feed shows as eventually consistent (<=120s),
    // matching the like-count behavior. The single-post + comment-thread tags
    // below refresh immediately. Avoids a full feed re-scan on every comment.
    updateTag(`post:${postId}`);
    updateTag(`post-comments:${postId}`);
    if (auraUsername) {
      updateTag(`user:${auraUsername}`);
    }
    await refreshHotPostRank(postId);
    if (postAuthorId && createdComment) {
      await notify({
        recipientId: postAuthorId,
        type: "comment",
        targetId: postId,
        actorId: session.userId,
        preview: createdComment.content,
      });
    }

    return { success: true, comment: createdComment };
  },
);

export const deleteCommentAction = withAction(
  {
    schema: z.object({ commentId: idSchema }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `delcomment:${session.userId}`,
    },
  },
  async ({ commentId }, { session, user }) => {
    // Resolve + authorize server-side (don't trust a client-supplied postId).
    const comment = await db.query.postCommentTable.findFirst({
      columns: { id: true, authorId: true, postId: true },
      where: eq(postCommentTable.id, commentId),
    });

    // A maintainer can remove anyone's comment; authors still delete their own.
    const isOwner = !!comment && comment.authorId === session.userId;
    const isMod = isModerator(user);

    if (!comment || (!isOwner && !isMod)) {
      return { error: "Comment not found" };
    }

    let auraUsername: string | null = null;

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
      const [updated] = await tx
        .update(postTable)
        .set({
          commentCount: sql`CASE WHEN ${postTable.commentCount} > 0 THEN ${postTable.commentCount} - 1 ELSE 0 END`,
        })
        .where(eq(postTable.id, comment.postId))
        .returning({ authorId: postTable.authorId });

      // Mirror the first-comment award: reverse the +5 only when the author
      // has no comment left on this post (fully retracted their commenting).
      if (updated?.authorId) {
        const remaining = await tx
          .select({ id: postCommentTable.id })
          .from(postCommentTable)
          .where(
            and(
              eq(postCommentTable.authorId, comment.authorId),
              eq(postCommentTable.postId, comment.postId),
            ),
          )
          .limit(1);

        if (remaining.length === 0) {
          // actorCreatedAt is the commenter's age; the deleter may be a mod, so
          // only trust it when the owner is deleting (else reverseAura no-ops).
          auraUsername = await reverseAura(tx, {
            beneficiaryId: updated.authorId,
            actorId: comment.authorId,
            actorCreatedAt: isOwner ? user?.createdAt : undefined,
            delta: AURA_POINTS.comment,
          });
        }
      }
    });

    // Mirror createCommentAction: refresh the single post + its thread, leave
    // the feed's commentCount eventually-consistent (<=120s).
    updateTag(`post:${comment.postId}`);
    updateTag(`post-comments:${comment.postId}`);
    if (auraUsername) {
      updateTag(`user:${auraUsername}`);
    }
    await refreshHotPostRank(comment.postId);

    return { success: true, postId: comment.postId };
  },
);

export const addLikeAction = withAction(
  {
    schema: z.object({ postId: idSchema }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `like:${session.userId}`,
    },
  },
  async ({ postId }, { session, user }) => {
    // Captured via .returning() on the count update — the like notification's
    // recipient (post author) and preview come free, no extra row read.
    let likedPost: { authorId: string; content: string } | undefined;
    let auraUsername: string | null = null;

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

      const [updated] = await tx
        .update(postTable)
        .set({
          likeCount: sql`${postTable.likeCount} + 1`,
        })
        .where(eq(postTable.id, postId))
        .returning({
          authorId: postTable.authorId,
          content: postTable.content,
        });

      likedPost = updated;

      if (updated) {
        auraUsername = await awardAura(tx, {
          beneficiaryId: updated.authorId,
          actorId: session.userId,
          actorCreatedAt: user?.createdAt,
          delta: AURA_POINTS.like,
        });
      }

      return { success: true };
    });

    updateTag(`post:${postId}`);
    // Note: intentionally not invalidating the "posts" feed tag here. A like
    // only changes likeCount, which the public feed shows as eventually
    // consistent (<=120s). The per-viewer liked tag below keeps the viewer's
    // own like state fresh. This avoids a full feed-cache miss on every like.
    updateTag(`post:${postId}:liked:${session.userId}`);
    if (auraUsername) {
      updateTag(`user:${auraUsername}`);
    }
    if (!("alreadyLiked" in result)) {
      await refreshHotPostRank(postId);
    }
    if (likedPost) {
      await notify({
        recipientId: likedPost.authorId,
        type: "like",
        targetId: postId,
        actorId: session.userId,
        preview: likedPost.content,
      });
    }
    return result;
  },
);

export const votePollAction = withAction(
  {
    schema: z.object({ optionId: idSchema }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `pollvote:${session.userId}`,
    },
  },
  async ({ optionId }, { session, user }) => {
    // The post is derived from the option server-side — a client-supplied
    // postId could pair a foreign option with another poll's unique slot.
    const [target] = await db
      .select({
        postId: pollOptionTable.postId,
        authorId: postTable.authorId,
        content: postTable.content,
        pollEndsAt: postTable.pollEndsAt,
      })
      .from(pollOptionTable)
      .innerJoin(postTable, eq(pollOptionTable.postId, postTable.id))
      .where(eq(pollOptionTable.id, optionId))
      .limit(1);

    if (!target) {
      return { error: "This poll is no longer available." };
    }

    // Read-time expiry — re-checked here because cached feeds can show a poll
    // as open for up to ~2 minutes past its end.
    if (!target.pollEndsAt || target.pollEndsAt.getTime() <= Date.now()) {
      return { error: POLL_ENDED_ERROR };
    }

    const postId = target.postId;
    let auraUsername: string | null = null;

    const result = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(pollVoteTable)
        .values({
          postId,
          optionId,
          userId: session.userId,
        })
        .onConflictDoNothing()
        .returning({ id: pollVoteTable.id });

      if (inserted.length === 0) {
        // Stale client (second device, profile feed without overlay): tell it
        // which option this user actually picked so it can self-correct.
        const [existing] = await tx
          .select({ optionId: pollVoteTable.optionId })
          .from(pollVoteTable)
          .where(
            and(
              eq(pollVoteTable.postId, postId),
              eq(pollVoteTable.userId, session.userId),
            ),
          )
          .limit(1);

        return {
          success: true,
          alreadyVoted: true,
          votedOptionId: existing?.optionId,
        };
      }

      await tx
        .update(pollOptionTable)
        .set({
          voteCount: sql`${pollOptionTable.voteCount} + 1`,
        })
        .where(eq(pollOptionTable.id, optionId));

      // Votes are final (unique per poll, no un-vote), so the denormalized
      // post total only ever increments — same transaction so it can't drift
      // from the option counts.
      await tx
        .update(postTable)
        .set({
          pollVoteCount: sql`${postTable.pollVoteCount} + 1`,
        })
        .where(eq(postTable.id, postId));

      auraUsername = await awardAura(tx, {
        beneficiaryId: target.authorId,
        actorId: session.userId,
        actorCreatedAt: user?.createdAt,
        delta: AURA_POINTS.pollVote,
      });

      return { success: true, votedOptionId: optionId };
    });

    updateTag(`post:${postId}`);
    // Like likes: counts in the public feed are eventually consistent (<=120s);
    // only the viewer's own vote state needs to be fresh. No "posts" bust.
    updateTag(`post:${postId}:poll-voted:${session.userId}`);
    if (auraUsername) {
      updateTag(`user:${auraUsername}`);
    }

    if (!("alreadyVoted" in result)) {
      await refreshHotPostRank(postId);
      await notify({
        recipientId: target.authorId,
        type: "vote",
        targetId: postId,
        actorId: session.userId,
        preview: target.content,
      });
    }

    return result;
  },
);

export const removeLikeAction = withAction(
  {
    schema: z.object({ postId: idSchema }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `like:${session.userId}`,
    },
  },
  async ({ postId }, { session, user }) => {
    let auraUsername: string | null = null;

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

      const [updated] = await tx
        .update(postTable)
        .set({
          likeCount: sql`CASE WHEN ${postTable.likeCount} > 0 THEN ${postTable.likeCount} - 1 ELSE 0 END`,
        })
        .where(eq(postTable.id, postId))
        .returning({ authorId: postTable.authorId });

      if (updated) {
        auraUsername = await reverseAura(tx, {
          beneficiaryId: updated.authorId,
          actorId: session.userId,
          actorCreatedAt: user?.createdAt,
          delta: AURA_POINTS.like,
        });
      }

      return { success: true };
    });

    updateTag(`post:${postId}`);
    // See addLikeAction: skip the "posts" feed tag; likeCount is eventually
    // consistent in the feed, and the per-viewer tag below stays fresh.
    updateTag(`post:${postId}:liked:${session.userId}`);
    if (auraUsername) {
      updateTag(`user:${auraUsername}`);
    }
    if (!("alreadyRemoved" in result)) {
      await refreshHotPostRank(postId);
    }

    return result;
  },
);

export const addCommentLikeAction = withAction(
  {
    schema: z.object({ commentId: idSchema }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `commentlike:${session.userId}`,
    },
  },
  async ({ commentId }, { session, user }) => {
    let auraUsername: string | null = null;

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

      const [updated] = await tx
        .update(postCommentTable)
        .set({
          likeCount: sql`${postCommentTable.likeCount} + 1`,
        })
        .where(eq(postCommentTable.id, commentId))
        .returning({ authorId: postCommentTable.authorId });

      if (updated) {
        auraUsername = await awardAura(tx, {
          beneficiaryId: updated.authorId,
          actorId: session.userId,
          actorCreatedAt: user?.createdAt,
          delta: AURA_POINTS.commentLike,
        });
      }

      return { success: true };
    });

    // A comment like only changes the per-viewer liked flag (the tag below,
    // overlaid fresh by getCommentViewerOverlay) and an eventually-consistent
    // likeCount. So don't bust the shared post-comments cache (re-scans every
    // comment + author join for all viewers), and the bare comment:<id> tag was
    // dead — no matching cacheTag exists. [audit #13, #18]
    updateTag(`comment:${commentId}:liked:${session.userId}`);
    if (auraUsername) {
      updateTag(`user:${auraUsername}`);
    }
    return result;
  },
);

export const removeCommentLikeAction = withAction(
  {
    schema: z.object({ commentId: idSchema }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `commentlike:${session.userId}`,
    },
  },
  async ({ commentId }, { session, user }) => {
    let auraUsername: string | null = null;

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

      const [updated] = await tx
        .update(postCommentTable)
        .set({
          likeCount: sql`CASE WHEN ${postCommentTable.likeCount} > 0 THEN ${postCommentTable.likeCount} - 1 ELSE 0 END`,
        })
        .where(eq(postCommentTable.id, commentId))
        .returning({ authorId: postCommentTable.authorId });

      if (updated) {
        auraUsername = await reverseAura(tx, {
          beneficiaryId: updated.authorId,
          actorId: session.userId,
          actorCreatedAt: user?.createdAt,
          delta: AURA_POINTS.commentLike,
        });
      }

      return { success: true };
    });

    // A comment like only changes the per-viewer liked flag (the tag below,
    // overlaid fresh by getCommentViewerOverlay) and an eventually-consistent
    // likeCount. So don't bust the shared post-comments cache (re-scans every
    // comment + author join for all viewers), and the bare comment:<id> tag was
    // dead — no matching cacheTag exists. [audit #13, #18]
    updateTag(`comment:${commentId}:liked:${session.userId}`);
    if (auraUsername) {
      updateTag(`user:${auraUsername}`);
    }
    return result;
  },
);

// Plain reposts only — quotes go through createPostAction with quotedPostId.
const createRepostSchema = z.object({
  postId: z.string(),
});

export const addRepostAction = withAction(
  {
    schema: createRepostSchema,
    rateLimit: {
      name: "write",
      key: ({ session }) => `repost:${session.userId}`,
    },
  },
  async ({ postId }, { session, user }) => {
    let auraUsername: string | null = null;

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

      const [updated] = await tx
        .update(postTable)
        .set({
          repostCount: sql`${postTable.repostCount} + 1`,
        })
        .where(eq(postTable.id, postId))
        .returning({ authorId: postTable.authorId });

      if (updated) {
        auraUsername = await awardAura(tx, {
          beneficiaryId: updated.authorId,
          actorId: session.userId,
          actorCreatedAt: user?.createdAt,
          delta: AURA_POINTS.repost,
        });
      }

      return { success: true, repost };
    });

    updateTag(`post:${postId}`);
    // Intentionally NOT invalidating the global "posts" feed tag: a full feed
    // recompute (union + inArray lookups) on every repost is the exact Turso
    // cost the like path avoids. The new edge surfaces via the 120s revalidate;
    // the actor's own state is kept fresh by the per-viewer reposted tag +
    // syncRepostCache.
    updateTag(`post:${postId}:reposted:${session.userId}`);
    if (auraUsername) {
      updateTag(`user:${auraUsername}`);
    }
    if (!("alreadyReposted" in result)) {
      await refreshHotPostRank(postId);
    }
    return result;
  },
);

export const removeRepostAction = withAction(
  {
    schema: z.object({ postId: idSchema }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `repost:${session.userId}`,
    },
  },
  async ({ postId }, { session, user }) => {
    let auraUsername: string | null = null;

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

      const [updated] = await tx
        .update(postTable)
        .set({
          repostCount: sql`CASE WHEN ${postTable.repostCount} > 0 THEN ${postTable.repostCount} - 1 ELSE 0 END`,
        })
        .where(eq(postTable.id, postId))
        .returning({ authorId: postTable.authorId });

      if (updated) {
        auraUsername = await reverseAura(tx, {
          beneficiaryId: updated.authorId,
          actorId: session.userId,
          actorCreatedAt: user?.createdAt,
          delta: AURA_POINTS.repost,
        });
      }

      return { success: true };
    });

    updateTag(`post:${postId}`);
    // See addRepostAction: skip the global "posts" recompute; the removed edge
    // ages out via the 120s revalidate, and the per-viewer tag stays fresh.
    updateTag(`post:${postId}:reposted:${session.userId}`);
    if (auraUsername) {
      updateTag(`user:${auraUsername}`);
    }
    if (!("alreadyRemoved" in result)) {
      await refreshHotPostRank(postId);
    }
    return result;
  },
);

/**
 * Pins one of the caller's own posts to their profile. One pin per user —
 * pinning a different post simply replaces the previous pin.
 */
export const pinPostAction = withAction(
  {
    schema: z.object({ postId: idSchema }),
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `pin:${session.userId}`,
    },
  },
  async ({ postId }, { session, user }) => {
    // Only your own, still-existing post can be pinned.
    const post = await db.query.postTable.findFirst({
      columns: { id: true, authorId: true },
      where: eq(postTable.id, postId),
    });

    if (!post || post.authorId !== session.userId) {
      return { error: "Post not found" };
    }

    await db
      .update(userTable)
      .set({ pinnedPostId: postId })
      .where(eq(userTable.id, session.userId));

    // The profile list re-renders with the pin on top; /api/me carries
    // pinnedPostId for the post-menu state.
    updateTag(`user-posts:${session.userId}`);
    updateTag(`user:${session.userId}`);
    updateTag(`user:${user.username}`);

    return { success: true };
  },
);

export const unpinPostAction = withAction(
  {
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `pin:${session.userId}`,
    },
  },
  async (_input, { session, user }) => {
    await db
      .update(userTable)
      .set({ pinnedPostId: null })
      .where(eq(userTable.id, session.userId));

    updateTag(`user-posts:${session.userId}`);
    updateTag(`user:${session.userId}`);
    updateTag(`user:${user.username}`);

    return { success: true };
  },
);
