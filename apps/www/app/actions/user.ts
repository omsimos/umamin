"use server";

import { hash, verify } from "@node-rs/argon2";
import { db } from "@umamin/db";
import { groupTable } from "@umamin/db/schema/group";
import { messageTable } from "@umamin/db/schema/message";
import { noteTable } from "@umamin/db/schema/note";
import {
  postCommentLikeTable,
  postCommentTable,
  postLikeTable,
  postRepostTable,
  postTable,
} from "@umamin/db/schema/post";
import {
  accountTable,
  userBlockTable,
  userFollowTable,
  userTable,
} from "@umamin/db/schema/user";
import { and, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { revalidateTag, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { sanitizeBlockedWords } from "@/lib/blocked-words";
import { publicImageUrl } from "@/lib/post-images";
import { checkRateLimit } from "@/lib/ratelimit";
import { idSchema } from "@/lib/schema";
import { getCurrentUserData, getUserProfileData } from "@/lib/server/data";
import { isUniqueConstraintViolation } from "@/lib/server/errors";
import { notify } from "@/lib/server/notifications";
import {
  claimStagedAvatar,
  claimStagedBanner,
  deletePostImages,
  deleteR2Avatar,
  deleteR2Banner,
  isR2Configured,
} from "@/lib/server/r2";
import { withAction } from "@/lib/server/with-action";
import {
  clearSessionCache,
  createSession,
  deleteSessionTokenCookie,
  generateSessionToken,
  getUserSessionIds,
  invalidateUserSessions,
  setSessionTokenCookie,
} from "@/lib/session";
import { formatContent } from "@/lib/utils";
import { generalSettingsSchema, passwordFormSchema } from "@/types/user";

// Avatars are rendered as raw <img src> across the app (not next/image), so an
// arbitrary stored URL would load from every viewer's browser (tracking-beacon /
// deanonymization / abusive image vector). Only Google profile pictures are
// applied by URL; uploaded photos go through updateProfilePhotoAction, which
// builds the URL server-side from a claimed R2 key.
const ALLOWED_AVATAR_HOSTS = new Set(["lh3.googleusercontent.com"]);

function isAllowedAvatarUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_AVATAR_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

// Sets the user's photo and returns the value it replaced, read in the same
// transaction (SQLite's single writer serializes concurrent swaps) so R2
// cleanup always targets the object that actually became unreachable.
async function swapUserImageUrl(userId: string, imageUrl: string | null) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ imageUrl: userTable.imageUrl })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    await tx
      .update(userTable)
      .set({ imageUrl })
      .where(eq(userTable.id, userId));

    return row?.imageUrl ?? null;
  });
}

// Banner counterpart of swapUserImageUrl: set the banner and return the value
// it replaced (read in the same transaction) so R2 cleanup targets the object
// that actually became unreachable.
async function swapUserBannerUrl(
  userId: string,
  bannerImageUrl: string | null,
) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ bannerImageUrl: userTable.bannerImageUrl })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    await tx
      .update(userTable)
      .set({ bannerImageUrl })
      .where(eq(userTable.id, userId));

    return row?.bannerImageUrl ?? null;
  });
}

export const getCurrentUserAction = withAction(
  {},
  async (_input, { session }) => getCurrentUserData(session.userId),
);

export async function getUserProfileAction(username: string) {
  try {
    const { session } = await getSession();
    return getUserProfileData(username, session?.userId);
  } catch (err) {
    console.log(err);
    return null;
  }
}

export const generalSettingsAction = withAction(
  {
    schema: generalSettingsSchema,
    rateLimit: {
      name: "write",
      key: ({ session }) => `settings:${session.userId}`,
    },
    onError: (err) =>
      isUniqueConstraintViolation(err, "user.username")
        ? { error: "Username already exists" }
        : undefined,
  },
  async (data, { session, user }) => {
    const normalized = {
      ...data,
      bio: formatContent(data.bio ?? ""),
      question: formatContent(data.question),
      displayName: data.displayName?.trim() ?? null,
      username: data.username?.trim().toLowerCase(),
    };

    const oldUsername = user?.username;

    await db
      .update(userTable)
      .set(normalized)
      .where(eq(userTable.id, session.userId));

    // Invalidate API cache for old and new user tags
    if (oldUsername) {
      updateTag(`user:${oldUsername}`);
    }
    if (data.username && data.username !== oldUsername) {
      updateTag(`user:${data.username}`);
    }
    updateTag(`user:${session.userId}`);
    updateTag(`user:${session.userId}:accounts`);

    return {
      success: true,
      user: normalized,
    };
  },
);

export async function deleteAccountAction(confirmation?: string) {
  const { user } = await getSession();

  if (!user) {
    throw new Error("Unauthorized");
  }

  // Enforce the confirmation phrase on the SERVER, not just via the disabled
  // button client-side, so a programmatic/CSRF/XSS call can't trigger this
  // irreversible delete without the explicit phrase. [audit #24]
  // (Stronger step-up auth — re-verifying the password / a fresh OAuth round —
  // is the recommended follow-up but needs a UI change for OAuth-only accounts.)
  if (confirmation?.trim().toLowerCase() !== "delete my account") {
    redirect("/settings?error=invalid_confirmation");
  }

  // Throttle this destructive ~10-statement transaction. Placed OUTSIDE the try
  // so the redirect's NEXT_REDIRECT isn't swallowed by the catch below.
  if (!(await checkRateLimit("auth", `delete-account:${user.id}`))) {
    redirect("/settings?error=rate_limited");
  }

  try {
    const uid = user.id;

    // Snapshot the user's R2 object keys and session ids BEFORE the cascade
    // deletes the rows that reference them (both bounded, indexed reads).
    // Sessions are only revoked AFTER the transaction commits — revoking up
    // front locked users out of an intact account when the delete failed.
    const postImageRows = await db
      .select({ images: postTable.images })
      .from(postTable)
      .where(and(eq(postTable.authorId, uid), isNotNull(postTable.images)));
    const sessionIds = await getUserSessionIds(uid);

    await db.transaction(async (tx) => {
      // FK CASCADE removes this user's follow/like/comment/repost rows when the
      // user row is deleted, but the app-maintained counters on the *surviving*
      // rows are not touched. Decrement them first (while the join rows still
      // exist) so other users' counts don't drift upward permanently.

      // Users I follow -> their follower_count.
      await tx
        .update(userTable)
        .set({
          followerCount: sql`CASE WHEN ${userTable.followerCount} > 0 THEN ${userTable.followerCount} - 1 ELSE 0 END`,
        })
        .where(
          inArray(
            userTable.id,
            tx
              .select({ id: userFollowTable.followingId })
              .from(userFollowTable)
              .where(eq(userFollowTable.followerId, uid)),
          ),
        );

      // Users who follow me -> their following_count.
      await tx
        .update(userTable)
        .set({
          followingCount: sql`CASE WHEN ${userTable.followingCount} > 0 THEN ${userTable.followingCount} - 1 ELSE 0 END`,
        })
        .where(
          inArray(
            userTable.id,
            tx
              .select({ id: userFollowTable.followerId })
              .from(userFollowTable)
              .where(eq(userFollowTable.followingId, uid)),
          ),
        );

      // Posts I liked -> their like_count.
      await tx
        .update(postTable)
        .set({
          likeCount: sql`CASE WHEN ${postTable.likeCount} > 0 THEN ${postTable.likeCount} - 1 ELSE 0 END`,
        })
        .where(
          inArray(
            postTable.id,
            tx
              .select({ id: postLikeTable.postId })
              .from(postLikeTable)
              .where(eq(postLikeTable.userId, uid)),
          ),
        );

      // Posts I reposted -> their repost_count.
      await tx
        .update(postTable)
        .set({
          repostCount: sql`CASE WHEN ${postTable.repostCount} > 0 THEN ${postTable.repostCount} - 1 ELSE 0 END`,
        })
        .where(
          inArray(
            postTable.id,
            tx
              .select({ id: postRepostTable.postId })
              .from(postRepostTable)
              .where(eq(postRepostTable.userId, uid)),
          ),
        );

      // Posts I commented on -> their comment_count (I may have several comments
      // on a single post, so subtract the actual count per post).
      await tx
        .update(postTable)
        .set({
          commentCount: sql`MAX(0, ${postTable.commentCount} - (SELECT COUNT(*) FROM ${postCommentTable} WHERE ${postCommentTable.postId} = ${postTable.id} AND ${postCommentTable.authorId} = ${uid}))`,
        })
        .where(
          inArray(
            postTable.id,
            tx
              .select({ id: postCommentTable.postId })
              .from(postCommentTable)
              .where(eq(postCommentTable.authorId, uid)),
          ),
        );

      // Comments I liked -> their like_count.
      await tx
        .update(postCommentTable)
        .set({
          likeCount: sql`CASE WHEN ${postCommentTable.likeCount} > 0 THEN ${postCommentTable.likeCount} - 1 ELSE 0 END`,
        })
        .where(
          inArray(
            postCommentTable.id,
            tx
              .select({ id: postCommentLikeTable.commentId })
              .from(postCommentLikeTable)
              .where(eq(postCommentLikeTable.userId, uid)),
          ),
        );

      // Members of groups this user OWNS keep a soft-ref equippedGroupId that
      // the FK cascade (which deletes those groups when the user row goes)
      // would otherwise leave dangling — null it first so nobody is stuck
      // wearing a deleted group's badge with no way to clear it.
      await tx
        .update(userTable)
        .set({ equippedGroupId: null })
        .where(
          inArray(
            userTable.equippedGroupId,
            tx
              .select({ id: groupTable.id })
              .from(groupTable)
              .where(eq(groupTable.creatorId, uid)),
          ),
        );

      // Remove the user's own data. Deleting the user row cascades the join
      // and authored-post rows; messages/accounts/notes have no FK cascade.
      await tx.delete(messageTable).where(eq(messageTable.receiverId, uid));
      await tx.delete(accountTable).where(eq(accountTable.userId, uid));
      await tx.delete(noteTable).where(eq(noteTable.userId, uid));
      await tx.delete(userTable).where(eq(userTable.id, uid));
    });

    // Cookie first: if the Redis clear below throws, the catch swallows it,
    // and this device must not be left holding a live-looking session cookie.
    await deleteSessionTokenCookie();

    // The FK cascade already removed the session rows; clear their cached
    // entries so other devices stop validating immediately rather than after
    // the cache TTL.
    await clearSessionCache(sessionIds);

    // Best-effort: the rows are gone, so these objects are unreachable —
    // delete them from storage rather than letting them orphan forever.
    await deletePostImages(postImageRows.flatMap((row) => row.images ?? []));
    await deleteR2Avatar(user.imageUrl);
    await deleteR2Banner(user.bannerImageUrl);

    // Invalidate user's cached data by tag
    updateTag(`user:${user.username}`);
    updateTag(`user:${user.id}`);
    updateTag(`user:${user.id}:accounts`);
    // Clear any badges baked into the shared feeds for members whose equipped
    // group was just torn down with this owner's account (background SWR).
    revalidateTag("posts", "max");
    revalidateTag("notes", "max");
  } catch (err) {
    console.log(err);
  }

  redirect("/login");
}

export const updatePasswordAction = withAction(
  {
    schema: passwordFormSchema,
    auth: "user",
    rateLimit: {
      name: "auth",
      key: ({ user }) => `pwd:${user.id}`,
    },
  },
  async ({ currentPassword, newPassword }, { user }) => {
    // If user has an existing password, require and verify current password
    if (user.passwordHash) {
      if (!currentPassword || currentPassword.length === 0) {
        return { error: "Current password is required" };
      }

      const validPassword = await verify(user.passwordHash, currentPassword, {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1,
      });

      if (!validPassword) {
        return { error: "Incorrect password" };
      }
    }

    const passwordHash = await hash(newPassword, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });

    await db
      .update(userTable)
      .set({ passwordHash })
      .where(eq(userTable.id, user.id));

    // Changing the password revokes all existing sessions (standard account
    // security — locks out a hijacked/old device) and drops their cached
    // entries, then re-mints one for the current request so the user stays
    // signed in here.
    await invalidateUserSessions(user.id);
    const token = generateSessionToken();
    const newSession = await createSession(token, user.id);
    await setSessionTokenCookie(token, new Date(newSession.expiresAt));

    return { success: true };
  },
);

export const followUserAction = withAction(
  {
    schema: z.object({ userId: idSchema }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `follow:${session.userId}`,
    },
  },
  async ({ userId }, { session, user }) => {
    if (session.userId === userId) {
      return { error: "You cannot follow yourself." };
    }

    const [target] = await db
      .select({ id: userTable.id, username: userTable.username })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    if (!target) {
      return { error: "User not found." };
    }

    // Enforce block state server-side, not just via the disabled button.
    const blockExists = await db.query.userBlockTable.findFirst({
      columns: { id: true },
      where: or(
        and(
          eq(userBlockTable.blockerId, session.userId),
          eq(userBlockTable.blockedId, userId),
        ),
        and(
          eq(userBlockTable.blockerId, userId),
          eq(userBlockTable.blockedId, session.userId),
        ),
      ),
    });

    if (blockExists) {
      return { error: "You can't follow this user." };
    }

    const result = await db.transaction(async (tx) => {
      // Increment only if the insert created the edge — a conflict (already
      // following) must not double-count the denormalized counters.
      const inserted = await tx
        .insert(userFollowTable)
        .values({
          followerId: session.userId,
          followingId: userId,
        })
        .onConflictDoNothing()
        .returning({ id: userFollowTable.id });

      if (inserted.length === 0) {
        return { success: true, alreadyFollowing: true };
      }

      await tx
        .update(userTable)
        .set({
          followingCount: sql`${userTable.followingCount} + 1`,
        })
        .where(eq(userTable.id, session.userId));

      await tx
        .update(userTable)
        .set({
          followerCount: sql`${userTable.followerCount} + 1`,
        })
        .where(eq(userTable.id, userId));

      return { success: true };
    });

    updateTag(`user:${target.username}`);
    updateTag(`user:${session.userId}`);
    updateTag(`user:${target.username}:followed:${session.userId}`);
    if (user?.username) {
      updateTag(`user:${user.username}`);
    }
    updateTag(`user-following:${session.userId}`);
    updateTag(`user-followers:${userId}`);

    if (!("alreadyFollowing" in result)) {
      await notify({
        recipientId: userId,
        type: "follow",
        actorId: session.userId,
      });
    }

    return result;
  },
);

export const unfollowUserAction = withAction(
  {
    schema: z.object({ userId: idSchema }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `follow:${session.userId}`,
    },
  },
  async ({ userId }, { session, user }) => {
    if (session.userId === userId) {
      return { error: "You cannot unfollow yourself." };
    }

    const [target] = await db
      .select({ id: userTable.id, username: userTable.username })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    if (!target) {
      return { error: "User not found." };
    }

    const result = await db.transaction(async (tx) => {
      // Decrement only if a row was deleted — concurrent unfollows must not
      // double-count.
      const removed = await tx
        .delete(userFollowTable)
        .where(
          and(
            eq(userFollowTable.followerId, session.userId),
            eq(userFollowTable.followingId, userId),
          ),
        )
        .returning({ id: userFollowTable.id });

      if (removed.length === 0) {
        return { success: true, alreadyRemoved: true };
      }

      await tx
        .update(userTable)
        .set({
          followingCount: sql`CASE WHEN ${userTable.followingCount} > 0 THEN ${userTable.followingCount} - 1 ELSE 0 END`,
        })
        .where(eq(userTable.id, session.userId));

      await tx
        .update(userTable)
        .set({
          followerCount: sql`CASE WHEN ${userTable.followerCount} > 0 THEN ${userTable.followerCount} - 1 ELSE 0 END`,
        })
        .where(eq(userTable.id, userId));

      return { success: true };
    });

    updateTag(`user:${target.username}`);
    updateTag(`user:${session.userId}`);
    updateTag(`user:${target.username}:followed:${session.userId}`);
    if (user?.username) {
      updateTag(`user:${user.username}`);
    }
    updateTag(`user-following:${session.userId}`);
    updateTag(`user-followers:${userId}`);

    return result;
  },
);

export const blockUserAction = withAction(
  {
    schema: z.object({ userId: idSchema }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `block:${session.userId}`,
    },
  },
  async ({ userId }, { session, user }) => {
    if (session.userId === userId) {
      return { error: "You cannot block yourself." };
    }

    const [target] = await db
      .select({ id: userTable.id, username: userTable.username })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    if (!target) {
      return { error: "User not found." };
    }

    const result = await db.transaction(async (tx) => {
      // Conflict → already blocked; skip the follow-severing below.
      const insertedBlock = await tx
        .insert(userBlockTable)
        .values({
          blockerId: session.userId,
          blockedId: userId,
        })
        .onConflictDoNothing()
        .returning({ id: userBlockTable.id });

      if (insertedBlock.length === 0) {
        return { success: true, alreadyBlocked: true };
      }

      // Blocking severs the follow both ways (like every major platform); each
      // decrement is gated on an actual delete.
      const removedOutgoing = await tx
        .delete(userFollowTable)
        .where(
          and(
            eq(userFollowTable.followerId, session.userId),
            eq(userFollowTable.followingId, userId),
          ),
        )
        .returning({ id: userFollowTable.id });

      if (removedOutgoing.length > 0) {
        await tx
          .update(userTable)
          .set({
            followingCount: sql`CASE WHEN ${userTable.followingCount} > 0 THEN ${userTable.followingCount} - 1 ELSE 0 END`,
          })
          .where(eq(userTable.id, session.userId));

        await tx
          .update(userTable)
          .set({
            followerCount: sql`CASE WHEN ${userTable.followerCount} > 0 THEN ${userTable.followerCount} - 1 ELSE 0 END`,
          })
          .where(eq(userTable.id, userId));
      }

      const removedIncoming = await tx
        .delete(userFollowTable)
        .where(
          and(
            eq(userFollowTable.followerId, userId),
            eq(userFollowTable.followingId, session.userId),
          ),
        )
        .returning({ id: userFollowTable.id });

      if (removedIncoming.length > 0) {
        await tx
          .update(userTable)
          .set({
            followingCount: sql`CASE WHEN ${userTable.followingCount} > 0 THEN ${userTable.followingCount} - 1 ELSE 0 END`,
          })
          .where(eq(userTable.id, userId));

        await tx
          .update(userTable)
          .set({
            followerCount: sql`CASE WHEN ${userTable.followerCount} > 0 THEN ${userTable.followerCount} - 1 ELSE 0 END`,
          })
          .where(eq(userTable.id, session.userId));
      }

      return { success: true };
    });

    updateTag(`user:${target.username}`);
    if (user?.username) {
      updateTag(`user:${user.username}`);
    }
    updateTag(`user:${target.username}:blocked:${session.userId}`);
    updateTag(`user:${target.username}:followed:${session.userId}`);
    if (user?.username) {
      updateTag(`user:${user.username}:blocked-by:${userId}`);
      updateTag(`user:${user.username}:followed:${userId}`);
    }
    updateTag(`user-blocks:${session.userId}`);
    updateTag(`user-blocks:${userId}`);
    updateTag(`user-following:${session.userId}`);
    updateTag(`user-followers:${userId}`);
    updateTag(`user-following:${userId}`);
    updateTag(`user-followers:${session.userId}`);
    // Blocking is per-viewer: the user-blocks:<viewer> tags above already
    // refresh both sides' feed + notes overlays (getPostFeedViewerOverlay /
    // getNoteViewerOverlay). Don't bust the global posts/notes caches for the
    // entire user base on every block. [audit #14]
    updateTag(`messages:received:${session.userId}`);
    updateTag(`messages:received:${userId}`);

    return result;
  },
);

export const unblockUserAction = withAction(
  {
    schema: z.object({ userId: idSchema }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `block:${session.userId}`,
    },
  },
  async ({ userId }, { session, user }) => {
    if (session.userId === userId) {
      return { error: "You cannot unblock yourself." };
    }

    const [target] = await db
      .select({ id: userTable.id, username: userTable.username })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    if (!target) {
      return { error: "User not found." };
    }

    const result = await db.transaction(async (tx) => {
      const existing = await tx.query.userBlockTable.findFirst({
        columns: { id: true },
        where: and(
          eq(userBlockTable.blockerId, session.userId),
          eq(userBlockTable.blockedId, userId),
        ),
      });

      if (!existing) {
        return { success: true, alreadyRemoved: true };
      }

      await tx
        .delete(userBlockTable)
        .where(
          and(
            eq(userBlockTable.blockerId, session.userId),
            eq(userBlockTable.blockedId, userId),
          ),
        );

      return { success: true };
    });

    updateTag(`user:${target.username}`);
    if (user?.username) {
      updateTag(`user:${user.username}`);
    }
    updateTag(`user:${target.username}:blocked:${session.userId}`);
    if (user?.username) {
      updateTag(`user:${user.username}:blocked-by:${userId}`);
    }
    updateTag(`user-blocks:${session.userId}`);
    updateTag(`user-blocks:${userId}`);
    // Blocking is per-viewer: the user-blocks:<viewer> tags above already
    // refresh both sides' feed + notes overlays (getPostFeedViewerOverlay /
    // getNoteViewerOverlay). Don't bust the global posts/notes caches for the
    // entire user base on every block. [audit #14]
    updateTag(`messages:received:${session.userId}`);
    updateTag(`messages:received:${userId}`);

    return result;
  },
);

export const toggleDisplayPictureAction = withAction(
  {
    schema: z.string().optional(),
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ user }) => `displaypic:${user.id}`,
    },
  },
  async (accountImgUrl, { user }) => {
    // When setting (not clearing) the picture, validate the incoming URL host —
    // it is rendered as a raw <img src> for every viewer.
    if (
      !user.imageUrl &&
      (!accountImgUrl || !isAllowedAvatarUrl(accountImgUrl))
    ) {
      return { error: "Invalid input" };
    }

    const imageUrl = user.imageUrl ? null : (accountImgUrl ?? null);

    // Swap inside a transaction so the cleanup target is the row's TRUE
    // current value — the session-cached user.imageUrl can be up to a minute
    // stale (Redis fast path), which could orphan or miss an object.
    const previousImageUrl = await swapUserImageUrl(user.id, imageUrl);

    // Hiding an uploaded photo retires it — delete the object (no-op for
    // Google/legacy URLs). Re-enabling shows the connected-account picture.
    if (!imageUrl) {
      await deleteR2Avatar(previousImageUrl);
    }

    // Invalidate user's cached data (imageUrl affects profile payload)
    updateTag(`user:${user.username}`);
    updateTag(`user:${user.id}`);
    updateTag(`user:${user.id}:accounts`);

    return { imageUrl };
  },
);

export const toggleQuietModeAction = withAction(
  {
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ user }) => `quiet:${user.id}`,
    },
  },
  async (_input, { user }) => {
    const quietMode = !user.quietMode;

    await db
      .update(userTable)
      .set({ quietMode })
      .where(eq(userTable.id, user.id));

    // Invalidate user's cached data (quiet mode affects profile payload)
    updateTag(`user:${user.username}`);
    updateTag(`user:${user.id}`);
    updateTag(`user:${user.id}:accounts`);

    return { quietMode };
  },
);

const blockedWordsSchema = z.object({
  // Loose pre-bound; sanitizeBlockedWords applies the real caps server-side.
  words: z.array(z.string().max(200)).max(200),
});

export const updateBlockedWordsAction = withAction(
  {
    schema: blockedWordsSchema,
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ user }) => `blockedwords:${user.id}`,
    },
  },
  async ({ words }, { user }) => {
    const blockedWords = sanitizeBlockedWords(words);

    await db
      .update(userTable)
      .set({ blockedWords })
      .where(eq(userTable.id, user.id));

    // Owner-private field; only the viewer's own cached record carries it.
    updateTag(`user:${user.id}`);

    return { success: true, blockedWords };
  },
);

export const updateAvatarAction = withAction(
  {
    schema: z.string(),
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ user }) => `avatar:${user.id}`,
    },
  },
  async (imageUrl, { user }) => {
    // imageUrl is rendered as a raw <img src> for every viewer — only allow
    // the Google host the UI supplies, over https.
    if (!isAllowedAvatarUrl(imageUrl)) {
      return { error: "Invalid input" };
    }

    // See toggleDisplayPictureAction: read the true previous value in the
    // same transaction as the swap, not the (possibly stale) session cache.
    const previousImageUrl = await swapUserImageUrl(user.id, imageUrl);

    // A replaced uploaded photo is unreachable from now on — delete it.
    if (previousImageUrl && previousImageUrl !== imageUrl) {
      await deleteR2Avatar(previousImageUrl);
    }

    updateTag(`user:${user.username}`);
    updateTag(`user:${user.id}`);
    updateTag(`user:${user.id}:accounts`);

    return { success: true, imageUrl };
  },
);

const profilePhotoSchema = z.object({
  key: z.string().min(1).max(200),
});

/**
 * Applies an uploaded profile photo: claims the staged R2 object (magic-byte
 * + size validated, copied to avatars/), stores its public URL, and deletes
 * the previous uploaded photo so a change never leaves an orphaned object.
 */
export const updateProfilePhotoAction = withAction(
  {
    schema: profilePhotoSchema,
    auth: "user",
    rateLimit: {
      name: "write",
      // Same key as presignAvatarUploadAction so the presign+claim cycle draws
      // from ONE 30/min budget instead of two stacked ones (each claim fans out
      // to ~4 R2 operations).
      key: ({ user }) => `avatarup:${user.id}`,
    },
  },
  async ({ key }, { user }) => {
    if (!isR2Configured()) {
      return { error: "Photo uploads aren't available right now." };
    }

    const finalKey = await claimStagedAvatar(user.id, key);

    if (!finalKey) {
      return { error: "Couldn't apply this photo. Please try again." };
    }

    const imageUrl = publicImageUrl(finalKey);
    let previousImageUrl: string | null;

    try {
      // See toggleDisplayPictureAction: the transactional read (not the
      // possibly-stale session cache) is what makes concurrent changes from
      // two devices delete the right object instead of orphaning one.
      previousImageUrl = await swapUserImageUrl(user.id, imageUrl);
    } catch (err) {
      // The claimed object must not outlive a failed update (storage leak).
      await deleteR2Avatar(imageUrl);
      throw err;
    }

    await deleteR2Avatar(previousImageUrl);

    updateTag(`user:${user.username}`);
    updateTag(`user:${user.id}`);
    updateTag(`user:${user.id}:accounts`);

    return { success: true, imageUrl };
  },
);

const profileBannerSchema = z.object({
  key: z.string().min(1).max(200),
});

/**
 * Applies an uploaded banner: claims the staged R2 object (magic-byte + size
 * validated, copied to banners/), stores its public URL, and deletes the
 * previous banner so a change never leaves an orphaned object. Mirrors
 * updateProfilePhotoAction; free to every signed-in user.
 */
export const updateProfileBannerAction = withAction(
  {
    schema: profileBannerSchema,
    auth: "user",
    rateLimit: {
      name: "write",
      // Shared with presignBannerUploadAction so presign+claim draw from ONE
      // budget (the claim fans out to ~4 R2 operations).
      key: ({ user }) => `bannerup:${user.id}`,
    },
  },
  async ({ key }, { user }) => {
    if (!isR2Configured()) {
      return { error: "Banner uploads aren't available right now." };
    }

    const finalKey = await claimStagedBanner(user.id, key);

    if (!finalKey) {
      return { error: "Couldn't apply this banner. Please try again." };
    }

    const bannerImageUrl = publicImageUrl(finalKey);
    let previousBannerUrl: string | null;

    try {
      previousBannerUrl = await swapUserBannerUrl(user.id, bannerImageUrl);
    } catch (err) {
      // The claimed object must not outlive a failed update (storage leak).
      await deleteR2Banner(bannerImageUrl);
      throw err;
    }

    await deleteR2Banner(previousBannerUrl);

    updateTag(`user:${user.username}`);
    updateTag(`user:${user.id}`);
    updateTag(`user:${user.id}:accounts`);

    return { success: true, bannerImageUrl };
  },
);

/** Clears the banner and deletes the stored object. */
export const removeProfileBannerAction = withAction(
  {
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ user }) => `bannerup:${user.id}`,
    },
  },
  async (_input, { user }) => {
    const previousBannerUrl = await swapUserBannerUrl(user.id, null);

    await deleteR2Banner(previousBannerUrl);

    updateTag(`user:${user.username}`);
    updateTag(`user:${user.id}`);
    updateTag(`user:${user.id}:accounts`);

    return { success: true };
  },
);
