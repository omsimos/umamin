import {
  userBlockTable,
  userFollowTable,
  userTable,
} from "@umamin/db/schema/user";
import { and, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import { type MusicAttachment, parseMusicUrl } from "../../lib/music";
import { publicImageUrl } from "../../lib/post-images";
import { generalSettingsSchema, passwordFormSchema } from "../../lib/types";
import { action } from "../../server-lib/action";
import { hash, verify } from "../../server-lib/argon2";
import { sanitizeBlockedWords } from "../../server-lib/blocked-words";
import { formatContent } from "../../server-lib/content";
import { getCurrentUserData, getUserProfileData } from "../../server-lib/data";
import type { Db } from "../../server-lib/db";
import {
  formatErrorChain,
  isUniqueConstraintViolation,
} from "../../server-lib/errors";
import { fetchMusicMeta } from "../../server-lib/music-meta";
import { notify } from "../../server-lib/notifications";
import { AURA_POINTS, awardAura, reverseAura } from "../../server-lib/points";
import { captureRequestException } from "../../server-lib/posthog";
import { createR2 } from "../../server-lib/r2";
import { idSchema } from "../../server-lib/schema";
import {
  createSession,
  generateSessionToken,
  invalidateUserSessions,
} from "../../server-lib/session";
import { setSessionCookie } from "../../server-lib/session-cookie";
import { ctxDb, defer } from "./_shared";

// Set the photo and return the value it replaced, read in the same transaction
// so R2 cleanup targets the object that actually became unreachable.
async function swapUserImageUrl(
  db: Db,
  userId: string,
  imageUrl: string | null,
) {
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

async function swapUserBannerUrl(
  db: Db,
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

export const getCurrentUserHandler = action({}, (_input, { session, c }) =>
  getCurrentUserData(ctxDb(c), session.userId, c.env.MODERATOR_USERS),
);

// Plain read embedded in the action file — session optional (viewer overlay).
export const getUserProfileHandler = action(
  { schema: z.object({ username: z.string().min(1) }), auth: "none" },
  async ({ username }, { session, c }) => {
    try {
      return await getUserProfileData(ctxDb(c), username, session?.userId);
    } catch (err) {
      console.error("Error fetching user profile:", formatErrorChain(err));
      captureRequestException(c, err, {
        distinctId: session?.userId,
        properties: { action: "getUserProfile" },
      });
      return null;
    }
  },
);

export const generalSettingsHandler = action(
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
  async (data, { session, c }) => {
    const normalized = {
      ...data,
      bio: formatContent(data.bio ?? ""),
      question: formatContent(data.question),
      displayName: data.displayName?.trim() ?? null,
      username: data.username?.trim().toLowerCase(),
    };

    await ctxDb(c)
      .update(userTable)
      .set(normalized)
      .where(eq(userTable.id, session.userId));

    return { success: true, user: normalized };
  },
);

const profileMusicSchema = z
  .object({
    musicUrl: z.string().trim().max(2048).optional(),
  })
  .refine((v) => !v.musicUrl || parseMusicUrl(v.musicUrl) !== null, {
    error: "That doesn't look like a supported song link.",
  });

export const updateProfileMusicHandler = action(
  {
    schema: profileMusicSchema,
    auth: "user",
    invalidInput: (error) => error.issues[0].message,
    rateLimit: {
      name: "write",
      key: ({ user }) => `profilemusic:${user.id}`,
    },
    errorMessage: "Failed to update profile song",
  },
  async ({ musicUrl }, { user, c }) => {
    const ref = musicUrl ? parseMusicUrl(musicUrl) : null;
    const { title, thumbnail } = ref
      ? await fetchMusicMeta(ref)
      : { title: null, thumbnail: null };

    await ctxDb(c)
      .update(userTable)
      .set({
        musicProvider: ref?.provider ?? null,
        musicId: ref?.id ?? null,
        musicTitle: title,
        musicThumbnail: thumbnail,
      })
      .where(eq(userTable.id, user.id));

    const music: MusicAttachment | null = ref
      ? { provider: ref.provider, id: ref.id, title, thumbnail }
      : null;

    return { success: true, music };
  },
);

export const updatePasswordHandler = action(
  {
    schema: passwordFormSchema,
    auth: "user",
    rateLimit: { name: "auth", key: ({ user }) => `pwd:${user.id}` },
  },
  async ({ currentPassword, newPassword }, { user, c }) => {
    const db = ctxDb(c);
    if (user.passwordHash) {
      if (!currentPassword || currentPassword.length === 0) {
        return { error: "Current password is required" };
      }
      const validPassword = await verify(user.passwordHash, currentPassword);
      if (!validPassword) {
        return { error: "Incorrect password" };
      }
    }

    const passwordHash = await hash(newPassword);

    await db
      .update(userTable)
      .set({ passwordHash })
      .where(eq(userTable.id, user.id));

    // Revoke all sessions (locks out old/hijacked devices) then re-mint one for
    // the current request so the user stays signed in here.
    await invalidateUserSessions(db, user.id);
    const token = generateSessionToken();
    const newSession = await createSession(db, token, user.id);
    setSessionCookie(c, token, new Date(newSession.expiresAt));

    return { success: true };
  },
);

export const followUserHandler = action(
  {
    schema: z.object({ userId: idSchema }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `follow:${session.userId}`,
    },
  },
  async ({ userId }, { session, user, c }) => {
    const db = ctxDb(c);
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

    const [blockExists] = await db
      .select({ id: userBlockTable.id })
      .from(userBlockTable)
      .where(
        or(
          and(
            eq(userBlockTable.blockerId, session.userId),
            eq(userBlockTable.blockedId, userId),
          ),
          and(
            eq(userBlockTable.blockerId, userId),
            eq(userBlockTable.blockedId, session.userId),
          ),
        ),
      )
      .limit(1);

    if (blockExists) {
      return { error: "You can't follow this user." };
    }

    const result = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(userFollowTable)
        .values({ followerId: session.userId, followingId: userId })
        .onConflictDoNothing()
        .returning({ id: userFollowTable.id });

      if (inserted.length === 0) {
        return { success: true, alreadyFollowing: true };
      }

      await tx
        .update(userTable)
        .set({ followingCount: sql`${userTable.followingCount} + 1` })
        .where(eq(userTable.id, session.userId));

      await tx
        .update(userTable)
        .set({ followerCount: sql`${userTable.followerCount} + 1` })
        .where(eq(userTable.id, userId));

      await awardAura(tx, {
        beneficiaryId: userId,
        actorId: session.userId,
        actorCreatedAt: user?.createdAt,
        delta: AURA_POINTS.follow,
      });

      return { success: true };
    });

    if (!("alreadyFollowing" in result)) {
      await notify(
        { db, env: c.env, defer: defer(c) },
        { recipientId: userId, type: "follow", actorId: session.userId },
      );
    }

    return result;
  },
);

export const unfollowUserHandler = action(
  {
    schema: z.object({ userId: idSchema }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `follow:${session.userId}`,
    },
  },
  async ({ userId }, { session, user, c }) => {
    const db = ctxDb(c);
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

    return db.transaction(async (tx) => {
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

      await reverseAura(tx, {
        beneficiaryId: userId,
        actorId: session.userId,
        actorCreatedAt: user?.createdAt,
        delta: AURA_POINTS.follow,
      });

      return { success: true };
    });
  },
);

export const blockUserHandler = action(
  {
    schema: z.object({ userId: idSchema }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `block:${session.userId}`,
    },
  },
  async ({ userId }, { session, user, c }) => {
    const db = ctxDb(c);
    if (session.userId === userId) {
      return { error: "You cannot block yourself." };
    }

    const [target] = await db
      .select({
        id: userTable.id,
        username: userTable.username,
        createdAt: userTable.createdAt,
      })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    if (!target) {
      return { error: "User not found." };
    }

    return db.transaction(async (tx) => {
      const insertedBlock = await tx
        .insert(userBlockTable)
        .values({ blockerId: session.userId, blockedId: userId })
        .onConflictDoNothing()
        .returning({ id: userBlockTable.id });

      if (insertedBlock.length === 0) {
        return { success: true, alreadyBlocked: true };
      }

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

        await reverseAura(tx, {
          beneficiaryId: userId,
          actorId: session.userId,
          actorCreatedAt: user?.createdAt,
          delta: AURA_POINTS.follow,
        });
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

        await reverseAura(tx, {
          beneficiaryId: session.userId,
          actorId: userId,
          actorCreatedAt: target.createdAt,
          delta: AURA_POINTS.follow,
        });
      }

      return { success: true };
    });
  },
);

export const unblockUserHandler = action(
  {
    schema: z.object({ userId: idSchema }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `block:${session.userId}`,
    },
  },
  async ({ userId }, { session, c }) => {
    const db = ctxDb(c);
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

    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: userBlockTable.id })
        .from(userBlockTable)
        .where(
          and(
            eq(userBlockTable.blockerId, session.userId),
            eq(userBlockTable.blockedId, userId),
          ),
        )
        .limit(1);

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
  },
);

export const toggleQuietModeHandler = action(
  {
    auth: "user",
    rateLimit: { name: "write", key: ({ user }) => `quiet:${user.id}` },
  },
  async (_input, { user, c }) => {
    const quietMode = !user.quietMode;

    await ctxDb(c)
      .update(userTable)
      .set({ quietMode })
      .where(eq(userTable.id, user.id));

    return { quietMode };
  },
);

const blockedWordsSchema = z.object({
  words: z.array(z.string().max(200)).max(200),
});

export const updateBlockedWordsHandler = action(
  {
    schema: blockedWordsSchema,
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ user }) => `blockedwords:${user.id}`,
    },
  },
  async ({ words }, { user, c }) => {
    const blockedWords = sanitizeBlockedWords(words);

    await ctxDb(c)
      .update(userTable)
      .set({ blockedWords })
      .where(eq(userTable.id, user.id));

    return { success: true, blockedWords };
  },
);

export const removeProfilePhotoHandler = action(
  {
    auth: "user",
    rateLimit: { name: "write", key: ({ user }) => `avatarrm:${user.id}` },
  },
  async (_input, { user, c }) => {
    const db = ctxDb(c);
    const previousImageUrl = await swapUserImageUrl(db, user.id, null);

    // No-ops on a Google URL left over from an older signup — only our own
    // avatars/ objects are deletable.
    const r2 = createR2(c.env);
    if (r2) await r2.deleteR2Avatar(previousImageUrl);

    return { success: true };
  },
);

const profilePhotoSchema = z.object({ key: z.string().min(1).max(200) });

export const updateProfilePhotoHandler = action(
  {
    schema: profilePhotoSchema,
    auth: "user",
    rateLimit: { name: "write", key: ({ user }) => `avatarup:${user.id}` },
  },
  async ({ key }, { user, c }) => {
    const db = ctxDb(c);
    const r2 = createR2(c.env);
    if (!r2) {
      return { error: "Photo uploads aren't available right now." };
    }

    const finalKey = await r2.claimStagedAvatar(user.id, key);
    if (!finalKey) {
      return { error: "Couldn't apply this photo. Please try again." };
    }

    const imageUrl = publicImageUrl(c.env.R2_PUBLIC_URL, finalKey);
    let previousImageUrl: string | null;

    try {
      previousImageUrl = await swapUserImageUrl(db, user.id, imageUrl);
    } catch (err) {
      await r2.deleteR2Avatar(imageUrl);
      throw err;
    }

    await r2.deleteR2Avatar(previousImageUrl);

    return { success: true, imageUrl };
  },
);

const profileBannerSchema = z.object({ key: z.string().min(1).max(200) });

export const updateProfileBannerHandler = action(
  {
    schema: profileBannerSchema,
    auth: "user",
    rateLimit: { name: "write", key: ({ user }) => `bannerup:${user.id}` },
  },
  async ({ key }, { user, c }) => {
    const db = ctxDb(c);
    const r2 = createR2(c.env);
    if (!r2) {
      return { error: "Banner uploads aren't available right now." };
    }

    const finalKey = await r2.claimStagedBanner(user.id, key);
    if (!finalKey) {
      return { error: "Couldn't apply this banner. Please try again." };
    }

    const bannerImageUrl = publicImageUrl(c.env.R2_PUBLIC_URL, finalKey);
    let previousBannerUrl: string | null;

    try {
      previousBannerUrl = await swapUserBannerUrl(db, user.id, bannerImageUrl);
    } catch (err) {
      await r2.deleteR2Banner(bannerImageUrl);
      throw err;
    }

    await r2.deleteR2Banner(previousBannerUrl);

    return { success: true, bannerImageUrl };
  },
);

export const removeProfileBannerHandler = action(
  {
    auth: "user",
    rateLimit: { name: "write", key: ({ user }) => `bannerup:${user.id}` },
  },
  async (_input, { user, c }) => {
    const db = ctxDb(c);
    const previousBannerUrl = await swapUserBannerUrl(db, user.id, null);

    const r2 = createR2(c.env);
    if (r2) await r2.deleteR2Banner(previousBannerUrl);

    return { success: true };
  },
);
