"use server";

import { hash, verify } from "@node-rs/argon2";
import { db } from "@umamin/db";
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
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { publicImageUrl } from "@/lib/post-images";
import { checkRateLimit, RATE_LIMIT_ERROR } from "@/lib/ratelimit";
import { getCurrentUserData, getUserProfileData } from "@/lib/server/data";
import {
  claimStagedAvatar,
  deletePostImages,
  deleteR2Avatar,
  isR2Configured,
} from "@/lib/server/r2";
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

export async function getCurrentUserAction() {
  try {
    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    return getCurrentUserData(session.userId);
  } catch (err) {
    console.log(err);
    return { error: "An error occured" };
  }
}

export async function getUserProfileAction(username: string) {
  try {
    const { session } = await getSession();
    return getUserProfileData(username, session?.userId);
  } catch (err) {
    console.log(err);
    return null;
  }
}

export async function generalSettingsAction(
  values: z.infer<typeof generalSettingsSchema>,
) {
  try {
    const params = generalSettingsSchema.safeParse(values);

    if (!params.success) {
      return { error: "Invalid input" };
    }

    const { session, user } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    if (!(await checkRateLimit("write", `settings:${session.userId}`))) {
      return { error: RATE_LIMIT_ERROR };
    }

    const data = params.data;
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
  } catch (err) {
    console.log(err);

    if (
      err instanceof Error &&
      typeof err.cause === "object" &&
      err.cause !== null
    ) {
      const cause = err.cause as { code?: string; message?: string };

      if (
        cause.code === "SQLITE_CONSTRAINT" &&
        cause.message?.includes("user.username")
      ) {
        return { error: "Username already exists" };
      }
    }

    return { error: "An error occured" };
  }
}

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

    // Invalidate user's cached data by tag
    updateTag(`user:${user.username}`);
    updateTag(`user:${user.id}`);
    updateTag(`user:${user.id}:accounts`);
  } catch (err) {
    console.log(err);
  }

  redirect("/login");
}

export async function updatePasswordAction(
  values: z.infer<typeof passwordFormSchema>,
) {
  try {
    const { user } = await getSession();

    if (!user) {
      throw new Error("Unauthorized");
    }

    const params = passwordFormSchema.safeParse(values);

    if (!params.success) {
      return { error: "Invalid input" };
    }

    if (!(await checkRateLimit("auth", `pwd:${user.id}`))) {
      return { error: RATE_LIMIT_ERROR };
    }

    const { currentPassword, newPassword } = params.data;

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
  } catch (err) {
    console.log(err);
    return { error: "An error occured" };
  }
}

export async function followUserAction({ userId }: { userId: string }) {
  try {
    const parsed = z.string().min(1).safeParse(userId);
    if (!parsed.success) {
      return { error: "Invalid input" };
    }
    const { session, user } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    if (session.userId === userId) {
      return { error: "You cannot follow yourself." };
    }

    if (!(await checkRateLimit("write", `follow:${session.userId}`))) {
      return { error: RATE_LIMIT_ERROR };
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

    return result;
  } catch (err) {
    console.log(err);
    return { error: "An error occured" };
  }
}

export async function unfollowUserAction({ userId }: { userId: string }) {
  try {
    const parsed = z.string().min(1).safeParse(userId);
    if (!parsed.success) {
      return { error: "Invalid input" };
    }
    const { session, user } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    if (session.userId === userId) {
      return { error: "You cannot unfollow yourself." };
    }

    if (!(await checkRateLimit("write", `follow:${session.userId}`))) {
      return { error: RATE_LIMIT_ERROR };
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
  } catch (err) {
    console.log(err);
    return { error: "An error occured" };
  }
}

export async function blockUserAction({ userId }: { userId: string }) {
  try {
    const parsed = z.string().min(1).safeParse(userId);
    if (!parsed.success) {
      return { error: "Invalid input" };
    }
    const { session, user } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    if (session.userId === userId) {
      return { error: "You cannot block yourself." };
    }

    if (!(await checkRateLimit("write", `block:${session.userId}`))) {
      return { error: RATE_LIMIT_ERROR };
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
  } catch (err) {
    console.log(err);
    return { error: "An error occured" };
  }
}

export async function unblockUserAction({ userId }: { userId: string }) {
  try {
    const parsed = z.string().min(1).safeParse(userId);
    if (!parsed.success) {
      return { error: "Invalid input" };
    }
    const { session, user } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    if (session.userId === userId) {
      return { error: "You cannot unblock yourself." };
    }

    if (!(await checkRateLimit("write", `block:${session.userId}`))) {
      return { error: RATE_LIMIT_ERROR };
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
  } catch (err) {
    console.log(err);
    return { error: "An error occured" };
  }
}

// Resolves a received message's sender server-side (scoped to the viewer's own
// inbox) so the recipient can block/unblock without the sender's account id
// ever reaching the client. [audit #22]
async function resolveMessageSenderId(
  messageId: string,
  viewerId: string,
): Promise<string | null> {
  const message = await db.query.messageTable.findFirst({
    columns: { senderId: true },
    where: and(
      eq(messageTable.id, messageId),
      eq(messageTable.receiverId, viewerId),
    ),
  });

  return message?.senderId ?? null;
}

export async function blockMessageSenderAction({
  messageId,
}: {
  messageId: string;
}) {
  const parsed = z.string().min(1).safeParse(messageId);
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const { session } = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const senderId = await resolveMessageSenderId(messageId, session.userId);
  if (!senderId) {
    return { error: "Cannot block this sender." };
  }

  return blockUserAction({ userId: senderId });
}

export async function unblockMessageSenderAction({
  messageId,
}: {
  messageId: string;
}) {
  const parsed = z.string().min(1).safeParse(messageId);
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const { session } = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const senderId = await resolveMessageSenderId(messageId, session.userId);
  if (!senderId) {
    return { error: "Cannot unblock this sender." };
  }

  return unblockUserAction({ userId: senderId });
}

export async function toggleDisplayPictureAction(accountImgUrl?: string) {
  try {
    const { user } = await getSession();

    if (!user) {
      throw new Error("Unauthorized");
    }

    if (!(await checkRateLimit("write", `displaypic:${user.id}`))) {
      return { error: RATE_LIMIT_ERROR };
    }

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
  } catch (err) {
    console.log(err);
    return { error: "An error occured" };
  }
}

export async function toggleQuietModeAction() {
  try {
    const { user } = await getSession();

    if (!user) {
      throw new Error("Unauthorized");
    }

    if (!(await checkRateLimit("write", `quiet:${user.id}`))) {
      return { error: RATE_LIMIT_ERROR };
    }

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
  } catch (err) {
    console.log(err);
    return { error: "An error occured" };
  }
}

export async function updateAvatarAction(imageUrl: string) {
  try {
    const { user } = await getSession();

    if (!user) {
      throw new Error("Unauthorized");
    }

    if (!(await checkRateLimit("write", `avatar:${user.id}`))) {
      return { error: RATE_LIMIT_ERROR };
    }

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
  } catch (err) {
    console.log(err);
    return { error: "An error occured" };
  }
}

const profilePhotoSchema = z.object({
  key: z.string().min(1).max(200),
});

/**
 * Applies an uploaded profile photo: claims the staged R2 object (magic-byte
 * + size validated, copied to avatars/), stores its public URL, and deletes
 * the previous uploaded photo so a change never leaves an orphaned object.
 */
export async function updateProfilePhotoAction(
  values: z.infer<typeof profilePhotoSchema>,
) {
  try {
    const params = profilePhotoSchema.safeParse(values);

    if (!params.success) {
      return { error: "Invalid input" };
    }

    const { user } = await getSession();

    if (!user) {
      throw new Error("Unauthorized");
    }

    if (!isR2Configured()) {
      return { error: "Photo uploads aren't available right now." };
    }

    // Same key as presignAvatarUploadAction so the presign+claim cycle draws
    // from ONE 30/min budget instead of two stacked ones (each claim fans out
    // to ~4 R2 operations).
    if (!(await checkRateLimit("write", `avatarup:${user.id}`))) {
      return { error: RATE_LIMIT_ERROR };
    }

    const finalKey = await claimStagedAvatar(user.id, params.data.key);

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
  } catch (err) {
    console.log(err);
    return { error: "An error occured" };
  }
}
