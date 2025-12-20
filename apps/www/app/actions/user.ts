"use server";

import { hash, verify } from "@node-rs/argon2";
import { db } from "@umamin/db";
import { messageTable } from "@umamin/db/schema/message";
import { noteTable } from "@umamin/db/schema/note";
import {
  accountTable,
  userBlockTable,
  userFollowTable,
  userTable,
} from "@umamin/db/schema/user";
import { and, eq, exists, sql } from "drizzle-orm";
import { cacheLife, cacheTag, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { cache } from "react";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  getGravatarFinalUrl,
  getGravatarPreviewUrl,
  hashEmailForGravatar,
  normaliseEmailForGravatar,
} from "@/lib/avatar";
import { deleteSessionTokenCookie, invalidateSession } from "@/lib/session";
import { generalSettingsSchema, passwordFormSchema } from "@/types/user";

const gravatarEmailSchema = z
  .string()
  .trim()
  .min(1, { error: "Email is required" })
  .email({ error: "Invalid email address" })
  .transform((value) => normaliseEmailForGravatar(value));

export async function getGravatarAction(email: string) {
  const parsed = gravatarEmailSchema.safeParse(email);

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid email address",
    };
  }

  try {
    const hash = hashEmailForGravatar(parsed.data);
    const previewUrl = getGravatarPreviewUrl(hash);

    const response = await fetch(previewUrl, {
      method: "GET",
      cache: "no-store",
    });

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

export const getCurrentUserAction = cache(async () => {
  try {
    const { session, user } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    const [userRecord] = await (async () => {
      "use cache: private";
      cacheTag(`user:${session.userId}`);
      cacheLife({ revalidate: 30 });

      return db
        .select()
        .from(userTable)
        .where(eq(userTable.id, session.userId))
        .limit(1);
    })();

    const accounts = userRecord
      ? await (async () => {
          "use cache: private";
          cacheTag(`user:${session.userId}:accounts`);
          cacheLife({ revalidate: 30 });

          return db
            .select()
            .from(accountTable)
            .where(eq(accountTable.userId, session.userId));
        })()
      : [];

    const data = userRecord ? { ...userRecord, accounts } : undefined;

    return { user: data };
  } catch (err) {
    console.log(err);
    return { error: "An error occured" };
  }
});

const userProfileRevalidate = 604800; // 7 days

export async function getUserProfileAction(username: string) {
  try {
    const getCached = async () => {
      "use cache";
      cacheTag(`user:${username}`);
      cacheLife({ revalidate: userProfileRevalidate });

      const [user] = await db
        .select({
          id: userTable.id,
          username: userTable.username,
          displayName: userTable.displayName,
          imageUrl: userTable.imageUrl,
          bio: userTable.bio,
          question: userTable.question,
          quietMode: userTable.quietMode,
          followerCount: userTable.followerCount,
          followingCount: userTable.followingCount,
          createdAt: userTable.createdAt,
          updatedAt: userTable.updatedAt,
        })
        .from(userTable)
        .where(eq(userTable.username, username))
        .limit(1);

      return user;
    };

    const user = await getCached();

    if (!user) {
      return null;
    }

    const { session } = await getSession();

    if (!session) {
      return user;
    }

    const [isFollowing, isBlocked, isBlockedBy] = await Promise.all([
      (async () => {
        "use cache: private";
        cacheTag(`user:${username}:followed:${session.userId}`);
        cacheLife({ revalidate: 30 });

        const follow = await db
          .select({
            following: exists(
              db
                .select({ id: userFollowTable.id })
                .from(userFollowTable)
                .where(
                  and(
                    eq(userFollowTable.followerId, session.userId),
                    eq(userFollowTable.followingId, user.id),
                  ),
                ),
            ),
          })
          .from(userTable)
          .where(eq(userTable.id, user.id))
          .limit(1);

        return Boolean(follow?.[0]?.following);
      })(),
      (async () => {
        "use cache: private";
        cacheTag(`user:${username}:blocked:${session.userId}`);
        cacheLife({ revalidate: 30 });

        const blocked = await db
          .select({
            blocked: exists(
              db
                .select({ id: userBlockTable.id })
                .from(userBlockTable)
                .where(
                  and(
                    eq(userBlockTable.blockerId, session.userId),
                    eq(userBlockTable.blockedId, user.id),
                  ),
                ),
            ),
          })
          .from(userTable)
          .where(eq(userTable.id, user.id))
          .limit(1);

        return Boolean(blocked?.[0]?.blocked);
      })(),
      (async () => {
        "use cache: private";
        cacheTag(`user:${username}:blocked-by:${session.userId}`);
        cacheLife({ revalidate: 30 });

        const blockedBy = await db
          .select({
            blocked: exists(
              db
                .select({ id: userBlockTable.id })
                .from(userBlockTable)
                .where(
                  and(
                    eq(userBlockTable.blockerId, user.id),
                    eq(userBlockTable.blockedId, session.userId),
                  ),
                ),
            ),
          })
          .from(userTable)
          .where(eq(userTable.id, user.id))
          .limit(1);

        return Boolean(blockedBy?.[0]?.blocked);
      })(),
    ]);

    return { ...user, isFollowing, isBlocked, isBlockedBy };
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

    const data = params.data;

    const oldUsername = user?.username;

    await db
      .update(userTable)
      .set(data)
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
  } catch (err) {
    console.log(err);
    return { error: "An error occured" };
  }
}

export async function deleteAccountAction() {
  const { user, session } = await getSession();

  if (!user) {
    throw new Error("Unauthorized");
  }

  try {
    await db.delete(messageTable).where(eq(messageTable.receiverId, user.id));
    await db.delete(accountTable).where(eq(accountTable.userId, user.id));
    await db.delete(noteTable).where(eq(noteTable.userId, user.id));
    await db.delete(userTable).where(eq(userTable.id, user.id));

    await invalidateSession(session.id);
    await deleteSessionTokenCookie();

    // Invalidate user's cached data by tag
    updateTag(`user:${user.username}`);
    updateTag(`user:${user.id}`);
    updateTag(`user:${user.id}:accounts`);
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
  } catch (err) {
    console.log(err);
    return { error: "An error occured" };
  }
}

export async function followUserAction({ userId }: { userId: string }) {
  try {
    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

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

    return result;
  } catch (err) {
    console.log(err);
    return { error: "An error occured" };
  }
}

export async function unfollowUserAction({ userId }: { userId: string }) {
  try {
    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

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

    return result;
  } catch (err) {
    console.log(err);
    return { error: "An error occured" };
  }
}

export async function blockUserAction({ userId }: { userId: string }) {
  try {
    const { session, user } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

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
    const { session, user } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

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

    await db
      .update(userTable)
      .set({ imageUrl })
      .where(eq(userTable.id, user.id));

    updateTag(`user:${user.username}`);

    return { success: true };
  } catch (err) {
    console.log(err);
    return { error: "An error occured" };
  }
}
