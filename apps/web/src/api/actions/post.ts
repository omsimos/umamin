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
import * as z from "zod";
import {
  hasImagePostingAura,
  IMAGE_AURA_REQUIRED_ERROR,
  MAX_POST_IMAGES,
  postImageInputSchema,
} from "../../lib/post-images";
import { action } from "../../server-lib/action";
import { hasUmaminPlus } from "../../server-lib/content";
import { getPostById } from "../../server-lib/data";
import { isModerator } from "../../server-lib/moderation";
import { notify } from "../../server-lib/notifications";
import { AURA_POINTS, awardAura, reverseAura } from "../../server-lib/points";
import {
  POLL_DURATIONS,
  POLL_ENDED_ERROR,
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  POLL_OPTION_MAX_LENGTH,
  POLL_PLUS_REQUIRED_ERROR,
  pollEndsAtFrom,
  sanitizePollOptions,
} from "../../server-lib/poll";
import { createR2 } from "../../server-lib/r2";
import { idSchema } from "../../server-lib/schema";
import { ctxDb, defer } from "./_shared";

// Cache-tag fan-out (revalidateTag/updateTag) is GONE in the Worker port: authed
// reads hit Turso directly (read-your-writes), public reads cache at route level.
// Per-write hot-feed rank refresh is likewise a no-op now — the */5 cron
// recomputes the ranking (≤5min lag accepted, plan feed-rank note).

const createPostSchema = z
  .object({
    content: z
      .string()
      .trim()
      .max(500, { error: "Content cannot exceed 500 characters" }),
    images: z.array(postImageInputSchema).max(MAX_POST_IMAGES).optional(),
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
  .refine((v) => v.content.length > 0 || (v.images?.length ?? 0) > 0, {
    error: "Content cannot be empty",
  })
  .refine((v) => !v.poll || v.content.length > 0, {
    error: "A poll needs a question",
  })
  .refine((v) => !(v.poll && (v.images?.length ?? 0) > 0), {
    error: "A post can have a poll or images, not both",
  });

// ── plain reads embedded in the action file (imperative queryFn callers) ─────
export const getPostHandler = action(
  { schema: z.object({ id: idSchema }), auth: "none" },
  ({ id }, { session, c }) =>
    getPostById(ctxDb(c), { postId: id, viewerId: session?.userId }),
);

export const getPostPublicHandler = action(
  { schema: z.object({ id: idSchema }), auth: "none" },
  ({ id }, { c }) => getPostById(ctxDb(c), { postId: id }),
);

export const createPostHandler = action(
  {
    schema: createPostSchema,
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `post:${session.userId}`,
    },
  },
  async ({ content, images, quotedPostId, poll }, { session, user, c }) => {
    const db = ctxDb(c);

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
      const [quoted] = await db
        .select({ id: postTable.id })
        .from(postTable)
        .where(eq(postTable.id, quotedPostId))
        .limit(1);
      if (!quoted) {
        return { error: "The post you're quoting is no longer available." };
      }
    }

    const r2 = createR2(c.env);
    let claimedImages: Awaited<
      ReturnType<NonNullable<typeof r2>["claimStagedImages"]>
    > = null;

    if (images?.length) {
      if (!r2) {
        return { error: "Image uploads aren't available right now." };
      }
      if (!hasImagePostingAura(user.points)) {
        return { error: IMAGE_AURA_REQUIRED_ERROR };
      }
      claimedImages = await r2.claimStagedImages(session.userId, images);
      if (!claimedImages) {
        return { error: "Couldn't attach images. Please try again." };
      }
    }

    const formattedContent = content
      .replace(/(\r\n|\n|\r){2,}/g, "\n\n")
      .trim();

    let createdPost: typeof postTable.$inferSelect;
    let createdPollOptions: (typeof pollOptionTable.$inferSelect)[] = [];

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

        if (quotedPostId) {
          const [bumped] = await tx
            .update(postTable)
            .set({ repostCount: sql`${postTable.repostCount} + 1` })
            .where(eq(postTable.id, quotedPostId))
            .returning({ authorId: postTable.authorId });

          if (bumped) {
            await awardAura(tx, {
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
      if (r2) await r2.deletePostImages(claimedImages);
      throw err;
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

export const deletePostHandler = action(
  {
    schema: z.object({ postId: idSchema }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `delpost:${session.userId}`,
    },
  },
  async ({ postId }, { session, user, c }) => {
    const db = ctxDb(c);
    const [post] = await db
      .select({
        id: postTable.id,
        authorId: postTable.authorId,
        images: postTable.images,
        quotedPostId: postTable.quotedPostId,
      })
      .from(postTable)
      .where(eq(postTable.id, postId))
      .limit(1);

    const isOwner = !!post && post.authorId === session.userId;
    const isMod = isModerator(user, c.env.MODERATOR_USERS);

    if (!post || (!isOwner && !isMod)) {
      return { error: "Post not found" };
    }

    const ownerId = post.authorId;

    await db.transaction(async (tx) => {
      await tx.delete(postTable).where(eq(postTable.id, postId));

      if (post.quotedPostId) {
        const [bumped] = await tx
          .update(postTable)
          .set({
            repostCount: sql`CASE WHEN ${postTable.repostCount} > 0 THEN ${postTable.repostCount} - 1 ELSE 0 END`,
          })
          .where(eq(postTable.id, post.quotedPostId))
          .returning({ authorId: postTable.authorId });

        if (bumped) {
          await reverseAura(tx, {
            beneficiaryId: bumped.authorId,
            actorId: ownerId,
            actorCreatedAt: isOwner ? user?.createdAt : undefined,
            delta: AURA_POINTS.quote,
          });
        }
      }

      await tx
        .update(userTable)
        .set({ pinnedPostId: null })
        .where(
          and(eq(userTable.id, ownerId), eq(userTable.pinnedPostId, postId)),
        );
    });

    const r2 = createR2(c.env);
    if (r2) await r2.deletePostImages(post.images);

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

export const createCommentHandler = action(
  {
    schema: createCommentSchema,
    rateLimit: {
      name: "write",
      key: ({ session }) => `comment:${session.userId}`,
    },
  },
  async ({ content, postId }, { session, user, c }) => {
    const db = ctxDb(c);
    let createdComment: typeof postCommentTable.$inferSelect | undefined;
    let postAuthorId: string | undefined;

    const formatted = content.replace(/(\r\n|\n|\r){2,}/g, "\n\n").trim();

    await db.transaction(async (tx) => {
      const [comment] = await tx
        .insert(postCommentTable)
        .values({ postId, content: formatted, authorId: session.userId })
        .returning();

      createdComment = comment;

      const [updated] = await tx
        .update(postTable)
        .set({ commentCount: sql`${postTable.commentCount} + 1` })
        .where(eq(postTable.id, postId))
        .returning({ authorId: postTable.authorId });

      postAuthorId = updated?.authorId;

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
          await awardAura(tx, {
            beneficiaryId: updated.authorId,
            actorId: session.userId,
            actorCreatedAt: user?.createdAt,
            delta: AURA_POINTS.comment,
          });
        }
      }
    });

    if (postAuthorId && createdComment) {
      await notify(
        { db, env: c.env, defer: defer(c) },
        {
          recipientId: postAuthorId,
          type: "comment",
          targetId: postId,
          actorId: session.userId,
          preview: createdComment.content,
        },
      );
    }

    return { success: true, comment: createdComment };
  },
);

export const deleteCommentHandler = action(
  {
    schema: z.object({ commentId: idSchema }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `delcomment:${session.userId}`,
    },
  },
  async ({ commentId }, { session, user, c }) => {
    const db = ctxDb(c);
    const [comment] = await db
      .select({
        id: postCommentTable.id,
        authorId: postCommentTable.authorId,
        postId: postCommentTable.postId,
      })
      .from(postCommentTable)
      .where(eq(postCommentTable.id, commentId))
      .limit(1);

    const isOwner = !!comment && comment.authorId === session.userId;
    const isMod = isModerator(user, c.env.MODERATOR_USERS);

    if (!comment || (!isOwner && !isMod)) {
      return { error: "Comment not found" };
    }

    await db.transaction(async (tx) => {
      const removed = await tx
        .delete(postCommentTable)
        .where(eq(postCommentTable.id, commentId))
        .returning({ id: postCommentTable.id });

      if (removed.length === 0) return;

      const [updated] = await tx
        .update(postTable)
        .set({
          commentCount: sql`CASE WHEN ${postTable.commentCount} > 0 THEN ${postTable.commentCount} - 1 ELSE 0 END`,
        })
        .where(eq(postTable.id, comment.postId))
        .returning({ authorId: postTable.authorId });

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
          await reverseAura(tx, {
            beneficiaryId: updated.authorId,
            actorId: comment.authorId,
            actorCreatedAt: isOwner ? user?.createdAt : undefined,
            delta: AURA_POINTS.comment,
          });
        }
      }
    });

    return { success: true, postId: comment.postId };
  },
);

export const addLikeHandler = action(
  {
    schema: z.object({ postId: idSchema }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `like:${session.userId}`,
    },
  },
  async ({ postId }, { session, user, c }) => {
    const db = ctxDb(c);
    let likedPost: { authorId: string; content: string } | undefined;

    const result = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(postLikeTable)
        .values({ postId, userId: session.userId })
        .onConflictDoNothing()
        .returning({ id: postLikeTable.id });

      if (inserted.length === 0) {
        return { success: true, alreadyLiked: true } as const;
      }

      const [updated] = await tx
        .update(postTable)
        .set({ likeCount: sql`${postTable.likeCount} + 1` })
        .where(eq(postTable.id, postId))
        .returning({
          authorId: postTable.authorId,
          content: postTable.content,
        });

      likedPost = updated;

      if (updated) {
        await awardAura(tx, {
          beneficiaryId: updated.authorId,
          actorId: session.userId,
          actorCreatedAt: user?.createdAt,
          delta: AURA_POINTS.like,
        });
      }

      return { success: true } as const;
    });

    if (likedPost) {
      await notify(
        { db, env: c.env, defer: defer(c) },
        {
          recipientId: likedPost.authorId,
          type: "like",
          targetId: postId,
          actorId: session.userId,
          preview: likedPost.content,
        },
      );
    }
    return result;
  },
);

export const votePollHandler = action(
  {
    schema: z.object({ optionId: idSchema }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `pollvote:${session.userId}`,
    },
  },
  async ({ optionId }, { session, user, c }) => {
    const db = ctxDb(c);
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
    if (!target.pollEndsAt || target.pollEndsAt.getTime() <= Date.now()) {
      return { error: POLL_ENDED_ERROR };
    }

    const postId = target.postId;

    const result = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(pollVoteTable)
        .values({ postId, optionId, userId: session.userId })
        .onConflictDoNothing()
        .returning({ id: pollVoteTable.id });

      if (inserted.length === 0) {
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
        } as const;
      }

      await tx
        .update(pollOptionTable)
        .set({ voteCount: sql`${pollOptionTable.voteCount} + 1` })
        .where(eq(pollOptionTable.id, optionId));

      await tx
        .update(postTable)
        .set({ pollVoteCount: sql`${postTable.pollVoteCount} + 1` })
        .where(eq(postTable.id, postId));

      await awardAura(tx, {
        beneficiaryId: target.authorId,
        actorId: session.userId,
        actorCreatedAt: user?.createdAt,
        delta: AURA_POINTS.pollVote,
      });

      return { success: true, votedOptionId: optionId } as const;
    });

    if (!("alreadyVoted" in result)) {
      await notify(
        { db, env: c.env, defer: defer(c) },
        {
          recipientId: target.authorId,
          type: "vote",
          targetId: postId,
          actorId: session.userId,
          preview: target.content,
        },
      );
    }

    return result;
  },
);

export const removeLikeHandler = action(
  {
    schema: z.object({ postId: idSchema }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `like:${session.userId}`,
    },
  },
  async ({ postId }, { session, user, c }) => {
    const db = ctxDb(c);
    return db.transaction(async (tx) => {
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
        await reverseAura(tx, {
          beneficiaryId: updated.authorId,
          actorId: session.userId,
          actorCreatedAt: user?.createdAt,
          delta: AURA_POINTS.like,
        });
      }

      return { success: true };
    });
  },
);

export const addCommentLikeHandler = action(
  {
    schema: z.object({ commentId: idSchema }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `commentlike:${session.userId}`,
    },
  },
  async ({ commentId }, { session, user, c }) => {
    const db = ctxDb(c);
    return db.transaction(async (tx) => {
      const inserted = await tx
        .insert(postCommentLikeTable)
        .values({ commentId, userId: session.userId })
        .onConflictDoNothing()
        .returning({ id: postCommentLikeTable.id });

      if (inserted.length === 0) {
        return { success: true, alreadyLiked: true };
      }

      const [updated] = await tx
        .update(postCommentTable)
        .set({ likeCount: sql`${postCommentTable.likeCount} + 1` })
        .where(eq(postCommentTable.id, commentId))
        .returning({ authorId: postCommentTable.authorId });

      if (updated) {
        await awardAura(tx, {
          beneficiaryId: updated.authorId,
          actorId: session.userId,
          actorCreatedAt: user?.createdAt,
          delta: AURA_POINTS.commentLike,
        });
      }

      return { success: true };
    });
  },
);

export const removeCommentLikeHandler = action(
  {
    schema: z.object({ commentId: idSchema }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `commentlike:${session.userId}`,
    },
  },
  async ({ commentId }, { session, user, c }) => {
    const db = ctxDb(c);
    return db.transaction(async (tx) => {
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
        await reverseAura(tx, {
          beneficiaryId: updated.authorId,
          actorId: session.userId,
          actorCreatedAt: user?.createdAt,
          delta: AURA_POINTS.commentLike,
        });
      }

      return { success: true };
    });
  },
);

export const addRepostHandler = action(
  {
    schema: z.object({ postId: z.string() }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `repost:${session.userId}`,
    },
  },
  async ({ postId }, { session, user, c }) => {
    const db = ctxDb(c);
    return db.transaction(async (tx) => {
      const [repost] = await tx
        .insert(postRepostTable)
        .values({ postId, userId: session.userId })
        .onConflictDoNothing()
        .returning();

      if (!repost) {
        return { success: true, alreadyReposted: true };
      }

      const [updated] = await tx
        .update(postTable)
        .set({ repostCount: sql`${postTable.repostCount} + 1` })
        .where(eq(postTable.id, postId))
        .returning({ authorId: postTable.authorId });

      if (updated) {
        await awardAura(tx, {
          beneficiaryId: updated.authorId,
          actorId: session.userId,
          actorCreatedAt: user?.createdAt,
          delta: AURA_POINTS.repost,
        });
      }

      return { success: true, repost };
    });
  },
);

export const removeRepostHandler = action(
  {
    schema: z.object({ postId: idSchema }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `repost:${session.userId}`,
    },
  },
  async ({ postId }, { session, user, c }) => {
    const db = ctxDb(c);
    return db.transaction(async (tx) => {
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
        await reverseAura(tx, {
          beneficiaryId: updated.authorId,
          actorId: session.userId,
          actorCreatedAt: user?.createdAt,
          delta: AURA_POINTS.repost,
        });
      }

      return { success: true };
    });
  },
);

export const pinPostHandler = action(
  {
    schema: z.object({ postId: idSchema }),
    auth: "user",
    rateLimit: { name: "write", key: ({ session }) => `pin:${session.userId}` },
  },
  async ({ postId }, { session, c }) => {
    const db = ctxDb(c);
    const [post] = await db
      .select({ id: postTable.id, authorId: postTable.authorId })
      .from(postTable)
      .where(eq(postTable.id, postId))
      .limit(1);

    if (!post || post.authorId !== session.userId) {
      return { error: "Post not found" };
    }

    await db
      .update(userTable)
      .set({ pinnedPostId: postId })
      .where(eq(userTable.id, session.userId));

    return { success: true };
  },
);

export const unpinPostHandler = action(
  {
    auth: "user",
    rateLimit: { name: "write", key: ({ session }) => `pin:${session.userId}` },
  },
  async (_input, { session, c }) => {
    const db = ctxDb(c);
    await db
      .update(userTable)
      .set({ pinnedPostId: null })
      .where(eq(userTable.id, session.userId));

    return { success: true };
  },
);
