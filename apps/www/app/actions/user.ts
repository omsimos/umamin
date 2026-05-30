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
  sessionTable,
  userBlockTable,
  userFollowTable,
  userTable,
} from "@umamin/db/schema/user";
import { and, eq, inArray, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  getGravatarFinalUrl,
  getGravatarPreviewUrl,
  hashEmailForGravatar,
  normaliseEmailForGravatar,
} from "@/lib/avatar";
import { checkRateLimit, RATE_LIMIT_ERROR } from "@/lib/ratelimit";
import { getCurrentUserData, getUserProfileData } from "@/lib/server/data";
import {
  createSession,
  deleteSessionTokenCookie,
  generateSessionToken,
  invalidateSession,
  setSessionTokenCookie,
} from "@/lib/session";
import { formatContent } from "@/lib/utils";
import { generalSettingsSchema, passwordFormSchema } from "@/types/user";

const gravatarEmailSchema = z
  .email({ error: "Invalid email address" })
  .transform((value) => normaliseEmailForGravatar(value));

// Avatars are rendered as raw <img src> across the app (not next/image), so an
// arbitrary stored URL would load from every viewer's browser (tracking-beacon /
// deanonymization / abusive image vector). Only allow the two hosts the UI ever
// supplies: Gravatar and Google profile pictures, over https.
const ALLOWED_AVATAR_HOSTS = new Set([
  "www.gravatar.com",
  "lh3.googleusercontent.com",
]);

function isAllowedAvatarUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_AVATAR_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export async function getGravatarAction(email: string) {
  const parsed = gravatarEmailSchema.safeParse(email);

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid email address",
    };
  }

  // Settings-only feature: require a session (the action carried none before)
  // and throttle the outbound fetch so it can't be looped as a cost/egress
  // amplifier or a Gravatar-enumeration oracle. No-ops locally (Redis unset).
  const { session } = await getSession();
  if (!session) {
    return { error: "Unauthorized" };
  }
  if (!(await checkRateLimit("write", `gravatar:${session.userId}`))) {
    return { error: RATE_LIMIT_ERROR };
  }

  try {
    const hash = hashEmailForGravatar(parsed.data);
    const previewUrl = getGravatarPreviewUrl(hash);

    // Bound the upstream call so a slow Gravatar response can't pin the
    // serverless function open (Active-CPU / hung-invocation cost).
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    let response: Response;
    try {
      response = await fetch(previewUrl, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return {
        error: "No Gravatar found for that email",
      };
    }

    return { url: getGravatarFinalUrl(hash) };
  } catch (error) {
    console.log("Error resolving Gravatar:", error);
    return { error: "Failed to reach Gravatar. Please try again later." };
  }
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

export async function deleteAccountAction() {
  const { user, session } = await getSession();

  if (!user) {
    throw new Error("Unauthorized");
  }

  // Throttle this destructive ~10-statement transaction. Placed OUTSIDE the try
  // so the redirect's NEXT_REDIRECT isn't swallowed by the catch below.
  if (!(await checkRateLimit("auth", `delete-account:${user.id}`))) {
    redirect("/settings?error=rate_limited");
  }

  try {
    const uid = user.id;

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

    await invalidateSession(session.id);
    await deleteSessionTokenCookie();

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
    // security — locks out a hijacked/old device), then re-mints one for the
    // current request so the user stays signed in here.
    await db.delete(sessionTable).where(eq(sessionTable.userId, user.id));
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

    const result = await db.transaction(async (tx) => {
      const existing = await tx.query.userFollowTable.findFirst({
        columns: { id: true },
        where: and(
          eq(userFollowTable.followerId, session.userId),
          eq(userFollowTable.followingId, userId),
        ),
      });

      if (existing) {
        return { success: true, alreadyFollowing: true };
      }

      await tx
        .insert(userFollowTable)
        .values({
          followerId: session.userId,
          followingId: userId,
        })
        .onConflictDoNothing();

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
      const existing = await tx.query.userFollowTable.findFirst({
        columns: { id: true },
        where: and(
          eq(userFollowTable.followerId, session.userId),
          eq(userFollowTable.followingId, userId),
        ),
      });

      if (!existing) {
        return { success: true, alreadyRemoved: true };
      }

      await tx
        .delete(userFollowTable)
        .where(
          and(
            eq(userFollowTable.followerId, session.userId),
            eq(userFollowTable.followingId, userId),
          ),
        );

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
      const existing = await tx.query.userBlockTable.findFirst({
        columns: { id: true },
        where: and(
          eq(userBlockTable.blockerId, session.userId),
          eq(userBlockTable.blockedId, userId),
        ),
      });

      if (existing) {
        return { success: true, alreadyBlocked: true };
      }

      await tx
        .insert(userBlockTable)
        .values({
          blockerId: session.userId,
          blockedId: userId,
        })
        .onConflictDoNothing();

      const follow = await tx.query.userFollowTable.findFirst({
        columns: { id: true },
        where: and(
          eq(userFollowTable.followerId, session.userId),
          eq(userFollowTable.followingId, userId),
        ),
      });

      if (follow) {
        await tx
          .delete(userFollowTable)
          .where(
            and(
              eq(userFollowTable.followerId, session.userId),
              eq(userFollowTable.followingId, userId),
            ),
          );

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
    }
    updateTag(`user-blocks:${session.userId}`);
    updateTag(`user-blocks:${userId}`);
    updateTag("posts");
    updateTag("notes");
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
    updateTag("posts");
    updateTag("notes");
    updateTag(`messages:received:${session.userId}`);
    updateTag(`messages:received:${userId}`);

    return result;
  } catch (err) {
    console.log(err);
    return { error: "An error occured" };
  }
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

    const imageUrl = user.imageUrl ? null : accountImgUrl;

    await db
      .update(userTable)
      .set({ imageUrl })
      .where(eq(userTable.id, user.id));

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

    // imageUrl is rendered as a raw <img src> for every viewer — only allow the
    // Gravatar / Google hosts the UI supplies, over https.
    if (!isAllowedAvatarUrl(imageUrl)) {
      return { error: "Invalid input" };
    }

    await db
      .update(userTable)
      .set({ imageUrl })
      .where(eq(userTable.id, user.id));

    updateTag(`user:${user.username}`);
    updateTag(`user:${user.id}`);
    updateTag(`user:${user.id}:accounts`);

    return { success: true, imageUrl };
  } catch (err) {
    console.log(err);
    return { error: "An error occured" };
  }
}
