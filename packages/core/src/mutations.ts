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
import { aesEncrypt } from "@umamin/encryption";
import { and, eq, or, sql } from "drizzle-orm";
import * as z from "zod";
import { getCurrentNoteData } from "./data";
import { registerSchema } from "./schema";
import type { SessionValidationResult } from "./session";
import { generalSettingsSchema, passwordFormSchema } from "./user";
import { formatContent } from "./utils";

type ActionResult<T = Record<string, unknown>> =
  | ({ success: true } & T)
  | { error: string };

function requireSession(result: SessionValidationResult) {
  if (!result.session) {
    throw new Error("Unauthorized");
  }
  return result;
}

function sqliteConstraintIncludes(err: unknown, text: string) {
  if (
    err instanceof Error &&
    typeof err.cause === "object" &&
    err.cause !== null
  ) {
    const cause = err.cause as { code?: string; message?: string };
    return cause.code === "SQLITE_CONSTRAINT" && cause.message?.includes(text);
  }

  return false;
}

export const createPostSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, { error: "Content cannot be empty" })
    .max(500, { error: "Content cannot exceed 500 characters" }),
});

export async function createPost(
  sessionResult: SessionValidationResult,
  values: z.infer<typeof createPostSchema>,
): Promise<ActionResult<{ post: typeof postTable.$inferSelect }>> {
  const params = createPostSchema.safeParse(values);
  if (!params.success) return { error: "Invalid input" };

  const { session } = requireSession(sessionResult);
  const [post] = await db
    .insert(postTable)
    .values({
      content: formatContent(params.data.content),
      authorId: session.userId,
    })
    .returning();

  return { success: true, post };
}

const idSchema = z.string().min(1);

export async function deletePost(
  sessionResult: SessionValidationResult,
  postId: string,
): Promise<ActionResult> {
  const parsed = idSchema.safeParse(postId);
  if (!parsed.success) return { error: "Invalid input" };

  const { session } = requireSession(sessionResult);
  const post = await db.query.postTable.findFirst({
    columns: { id: true, authorId: true },
    where: eq(postTable.id, postId),
  });

  if (!post || post.authorId !== session.userId) {
    return { error: "Post not found" };
  }

  await db.delete(postTable).where(eq(postTable.id, postId));
  return { success: true };
}

export const createCommentSchema = z.object({
  postId: z.string(),
  content: z
    .string()
    .trim()
    .min(1, { error: "Content cannot be empty" })
    .max(500, { error: "Content cannot exceed 500 characters" }),
});

export async function createComment(
  sessionResult: SessionValidationResult,
  values: z.infer<typeof createCommentSchema>,
): Promise<ActionResult<{ comment?: typeof postCommentTable.$inferSelect }>> {
  const params = createCommentSchema.safeParse(values);
  if (!params.success) return { error: "Invalid input" };

  const { session } = requireSession(sessionResult);
  const { content, postId } = params.data;
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
      .set({ commentCount: sql`${postTable.commentCount} + 1` })
      .where(eq(postTable.id, postId));
  });

  return { success: true, comment: createdComment };
}

export async function setPostLike(
  sessionResult: SessionValidationResult,
  postId: string,
  liked: boolean,
) {
  const parsed = idSchema.safeParse(postId);
  if (!parsed.success) return { error: "Invalid input" };

  const { session } = requireSession(sessionResult);
  return db.transaction(async (tx) => {
    const existing = await tx.query.postLikeTable.findFirst({
      columns: { id: true },
      where: and(
        eq(postLikeTable.postId, postId),
        eq(postLikeTable.userId, session.userId),
      ),
    });

    if (liked) {
      if (existing) return { success: true, alreadyLiked: true };
      await tx.insert(postLikeTable).values({ postId, userId: session.userId });
      await tx
        .update(postTable)
        .set({ likeCount: sql`${postTable.likeCount} + 1` })
        .where(eq(postTable.id, postId));
      return { success: true };
    }

    if (!existing) return { success: true, alreadyRemoved: true };
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
}

export async function setCommentLike(
  sessionResult: SessionValidationResult,
  commentId: string,
  liked: boolean,
) {
  const parsed = idSchema.safeParse(commentId);
  if (!parsed.success) return { error: "Invalid input" };

  const { session } = requireSession(sessionResult);
  return db.transaction(async (tx) => {
    const existing = await tx.query.postCommentLikeTable.findFirst({
      columns: { id: true },
      where: and(
        eq(postCommentLikeTable.commentId, commentId),
        eq(postCommentLikeTable.userId, session.userId),
      ),
    });

    if (liked) {
      if (existing) return { success: true, alreadyLiked: true };
      await tx
        .insert(postCommentLikeTable)
        .values({ commentId, userId: session.userId });
      await tx
        .update(postCommentTable)
        .set({ likeCount: sql`${postCommentTable.likeCount} + 1` })
        .where(eq(postCommentTable.id, commentId));
      return { success: true };
    }

    if (!existing) return { success: true, alreadyRemoved: true };
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
}

export const createRepostSchema = z.object({
  postId: z.string(),
  content: z
    .string()
    .trim()
    .max(500, { error: "Content cannot exceed 500 characters" })
    .optional()
    .or(z.literal("")),
});

export async function setRepost(
  sessionResult: SessionValidationResult,
  values: z.infer<typeof createRepostSchema>,
  reposted: boolean,
) {
  const params = createRepostSchema.safeParse(values);
  if (!params.success) return { error: "Invalid input" };

  const { session } = requireSession(sessionResult);
  const { postId, content } = params.data;
  return db.transaction(async (tx) => {
    const existing = await tx.query.postRepostTable.findFirst({
      columns: { id: true },
      where: and(
        eq(postRepostTable.postId, postId),
        eq(postRepostTable.userId, session.userId),
      ),
    });

    if (reposted) {
      if (existing) return { success: true, alreadyReposted: true };
      await tx.insert(postRepostTable).values({
        postId,
        userId: session.userId,
        content: content?.trim() ? formatContent(content) : null,
      });
      await tx
        .update(postTable)
        .set({ repostCount: sql`${postTable.repostCount} + 1` })
        .where(eq(postTable.id, postId));
      return { success: true };
    }

    if (!existing) return { success: true, alreadyRemoved: true };
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
}

export const createNoteSchema = z.object({
  isAnonymous: z.boolean().default(false),
  content: z
    .string()
    .min(1, { error: "Content cannot be empty" })
    .max(500, { error: "Content cannot exceed 500 characters" }),
});

export async function createNote(
  sessionResult: SessionValidationResult,
  values: z.infer<typeof createNoteSchema>,
) {
  const params = createNoteSchema.safeParse(values);
  if (!params.success) {
    return { error: params.error.issues[0]?.message ?? "Invalid input" };
  }

  const { session } = requireSession(sessionResult);
  const formattedContent = formatContent(params.data.content);

  await db
    .insert(noteTable)
    .values({
      userId: session.userId,
      content: formattedContent,
      isAnonymous: params.data.isAnonymous,
    })
    .onConflictDoUpdate({
      target: noteTable.userId,
      set: {
        content: formattedContent,
        isAnonymous: params.data.isAnonymous,
        updatedAt: sql`(unixepoch())`,
      },
    });

  return { success: true, note: await getCurrentNoteData(session.userId) };
}

export async function clearNote(sessionResult: SessionValidationResult) {
  const { session } = requireSession(sessionResult);
  await db
    .update(noteTable)
    .set({ content: "" })
    .where(eq(noteTable.userId, session.userId));
  return { success: true };
}

export async function deleteMessage(
  sessionResult: SessionValidationResult,
  id: string,
) {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { error: "Invalid input" };

  const { session } = requireSession(sessionResult);
  await db
    .delete(messageTable)
    .where(
      and(eq(messageTable.id, id), eq(messageTable.receiverId, session.userId)),
    );
  return { success: true };
}

export const replySchema = z.object({
  messageId: z.string().min(1),
  content: z
    .string()
    .trim()
    .min(1, { error: "Content cannot be empty" })
    .max(500, { error: "Content cannot exceed 500 characters" }),
});

export async function createReply(
  sessionResult: SessionValidationResult,
  values: z.infer<typeof replySchema>,
) {
  const params = replySchema.safeParse(values);
  if (!params.success) return { error: "Invalid input" };

  const { session } = requireSession(sessionResult);
  const encryptedReply = await aesEncrypt(params.data.content);

  await db
    .update(messageTable)
    .set({ reply: encryptedReply })
    .where(
      and(
        eq(messageTable.id, params.data.messageId),
        eq(messageTable.receiverId, session.userId),
      ),
    );

  return { success: true, reply: params.data.content, updatedAt: new Date() };
}

export const sendMessageSchema = z.object({
  question: z.string().trim().min(1).max(500),
  content: z.string().trim().min(1).max(500),
  receiverId: z.string().min(1),
});

export async function sendMessage(
  sessionResult: SessionValidationResult,
  values: z.infer<typeof sendMessageSchema>,
) {
  const params = sendMessageSchema.safeParse(values);
  if (!params.success) return { error: "Invalid input" };

  const { question, content, receiverId } = params.data;
  const senderId = sessionResult.session?.userId ?? null;

  if (receiverId === senderId) {
    return { error: "You can't send a message to yourself" };
  }

  if (senderId) {
    const blocked = await db.query.userBlockTable.findFirst({
      columns: { id: true },
      where: or(
        and(
          eq(userBlockTable.blockerId, receiverId),
          eq(userBlockTable.blockedId, senderId),
        ),
        and(
          eq(userBlockTable.blockerId, senderId),
          eq(userBlockTable.blockedId, receiverId),
        ),
      ),
    });

    if (blocked) return { success: true };
  }

  await db.insert(messageTable).values({
    senderId,
    receiverId,
    question,
    content: await aesEncrypt(formatContent(content)),
  });

  return { success: true };
}

export async function loginWithPassword(username: string, password: string) {
  const normalizedUsername = username.trim().toLowerCase();
  if (
    normalizedUsername.length < 5 ||
    normalizedUsername.length > 20 ||
    !/^[a-zA-Z0-9_-]+$/.test(normalizedUsername) ||
    password.length < 5 ||
    password.length > 255
  ) {
    return { error: "Incorrect username or password" };
  }

  const [existingUser] = await db
    .select()
    .from(userTable)
    .where(eq(userTable.username, normalizedUsername))
    .limit(1);

  if (!existingUser?.passwordHash) {
    return { error: "Incorrect username or password" };
  }

  const validPassword = await verify(existingUser.passwordHash, password, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });

  if (!validPassword) {
    return { error: "Incorrect username or password" };
  }

  return { success: true, userId: existingUser.id };
}

export async function signupWithPassword(
  values: z.infer<typeof registerSchema>,
) {
  const validatedFields = registerSchema.safeParse({
    ...values,
    username: values.username?.trim().toLowerCase(),
  });

  if (!validatedFields.success) return { error: "Invalid input" };

  const passwordHash = await hash(validatedFields.data.password, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });

  try {
    const [user] = await db
      .insert(userTable)
      .values({
        username: validatedFields.data.username.toLowerCase(),
        passwordHash,
      })
      .returning({ id: userTable.id });

    return { success: true, userId: user.id };
  } catch (err) {
    if (sqliteConstraintIncludes(err, "user.username")) {
      return { error: "Username already exists" };
    }
    throw err;
  }
}

export async function updateGeneralSettings(
  sessionResult: SessionValidationResult,
  values: z.infer<typeof generalSettingsSchema>,
) {
  const params = generalSettingsSchema.safeParse(values);
  if (!params.success) return { error: "Invalid input" };

  const { session } = requireSession(sessionResult);
  const data = params.data;
  const normalized = {
    ...data,
    bio: formatContent(data.bio ?? ""),
    question: formatContent(data.question),
    displayName: data.displayName?.trim() ?? null,
    username: data.username?.trim().toLowerCase(),
  };

  try {
    await db
      .update(userTable)
      .set(normalized)
      .where(eq(userTable.id, session.userId));
    return { success: true, user: normalized };
  } catch (err) {
    if (sqliteConstraintIncludes(err, "user.username")) {
      return { error: "Username already exists" };
    }
    throw err;
  }
}

export async function deleteAccount(sessionResult: SessionValidationResult) {
  const { session, user } = requireSession(sessionResult);
  await db.delete(messageTable).where(eq(messageTable.receiverId, user.id));
  await db.delete(accountTable).where(eq(accountTable.userId, user.id));
  await db.delete(noteTable).where(eq(noteTable.userId, user.id));
  await db.delete(userTable).where(eq(userTable.id, user.id));
  return { success: true, sessionId: session.id };
}

export async function updatePassword(
  sessionResult: SessionValidationResult,
  values: z.infer<typeof passwordFormSchema>,
) {
  const { user } = requireSession(sessionResult);
  const params = passwordFormSchema.safeParse(values);
  if (!params.success) return { error: "Invalid input" };

  const { currentPassword, newPassword } = params.data;
  if (user.passwordHash) {
    if (!currentPassword) return { error: "Current password is required" };
    const validPassword = await verify(user.passwordHash, currentPassword, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });
    if (!validPassword) return { error: "Incorrect password" };
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
  return { success: true };
}

async function getTargetUser(userId: string) {
  const [target] = await db
    .select({ id: userTable.id, username: userTable.username })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  return target ?? null;
}

export async function setFollow(
  sessionResult: SessionValidationResult,
  userId: string,
  following: boolean,
) {
  const parsed = idSchema.safeParse(userId);
  if (!parsed.success) return { error: "Invalid input" };
  const { session } = requireSession(sessionResult);
  if (session.userId === userId) {
    return {
      error: following
        ? "You cannot follow yourself."
        : "You cannot unfollow yourself.",
    };
  }
  if (!(await getTargetUser(userId))) return { error: "User not found." };

  return db.transaction(async (tx) => {
    const existing = await tx.query.userFollowTable.findFirst({
      columns: { id: true },
      where: and(
        eq(userFollowTable.followerId, session.userId),
        eq(userFollowTable.followingId, userId),
      ),
    });

    if (following) {
      if (existing) return { success: true, alreadyFollowing: true };
      await tx.insert(userFollowTable).values({
        followerId: session.userId,
        followingId: userId,
      });
      await tx
        .update(userTable)
        .set({ followingCount: sql`${userTable.followingCount} + 1` })
        .where(eq(userTable.id, session.userId));
      await tx
        .update(userTable)
        .set({ followerCount: sql`${userTable.followerCount} + 1` })
        .where(eq(userTable.id, userId));
      return { success: true };
    }

    if (!existing) return { success: true, alreadyRemoved: true };
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
}

export async function setBlock(
  sessionResult: SessionValidationResult,
  userId: string,
  blocked: boolean,
) {
  const parsed = idSchema.safeParse(userId);
  if (!parsed.success) return { error: "Invalid input" };
  const { session } = requireSession(sessionResult);
  if (session.userId === userId) {
    return {
      error: blocked
        ? "You cannot block yourself."
        : "You cannot unblock yourself.",
    };
  }
  if (!(await getTargetUser(userId))) return { error: "User not found." };

  return db.transaction(async (tx) => {
    const existing = await tx.query.userBlockTable.findFirst({
      columns: { id: true },
      where: and(
        eq(userBlockTable.blockerId, session.userId),
        eq(userBlockTable.blockedId, userId),
      ),
    });

    if (blocked) {
      if (existing) return { success: true, alreadyBlocked: true };
      await tx.insert(userBlockTable).values({
        blockerId: session.userId,
        blockedId: userId,
      });
      await tx
        .delete(userFollowTable)
        .where(
          and(
            eq(userFollowTable.followerId, session.userId),
            eq(userFollowTable.followingId, userId),
          ),
        );
      return { success: true };
    }

    if (!existing) return { success: true, alreadyRemoved: true };
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
}

export async function toggleDisplayPicture(
  sessionResult: SessionValidationResult,
  accountImgUrl?: string,
) {
  const { user } = requireSession(sessionResult);
  const imageUrl = user.imageUrl ? null : accountImgUrl;
  await db.update(userTable).set({ imageUrl }).where(eq(userTable.id, user.id));
  return { imageUrl };
}

export async function toggleQuietMode(sessionResult: SessionValidationResult) {
  const { user } = requireSession(sessionResult);
  const quietMode = !user.quietMode;
  await db
    .update(userTable)
    .set({ quietMode })
    .where(eq(userTable.id, user.id));
  return { quietMode };
}

export async function updateAvatar(
  sessionResult: SessionValidationResult,
  imageUrl: string,
) {
  const { user } = requireSession(sessionResult);
  await db.update(userTable).set({ imageUrl }).where(eq(userTable.id, user.id));
  return { success: true, imageUrl };
}
