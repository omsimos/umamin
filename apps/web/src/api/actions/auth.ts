import { groupMemberTable, groupTable } from "@umamin/db/schema/group";
import { messageTable } from "@umamin/db/schema/message";
import { noteTable } from "@umamin/db/schema/note";
import type { PostImage } from "@umamin/db/schema/post";
import {
  pollOptionTable,
  pollVoteTable,
  postCommentLikeTable,
  postCommentTable,
  postLikeTable,
  postRepostTable,
  postTable,
} from "@umamin/db/schema/post";
import {
  accountTable,
  userFollowTable,
  userTable,
} from "@umamin/db/schema/user";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";
import { hash, verify } from "../../server-lib/argon2";
import { generateUsernameId } from "../../server-lib/content";
import { passesCsrf } from "../../server-lib/csrf";
import {
  ACCESS_BLOCKED_ERROR,
  ACCOUNT_DELETE_FAILED_ERROR,
  accountSuspendedMessage,
  DELETE_CONFIRMATION_ERROR,
  formatErrorChain,
  GENERIC_ERROR,
} from "../../server-lib/errors";
import { extractClientIp } from "../../server-lib/ip";
import { isIpDenied } from "../../server-lib/ip-denylist";
import { AURA_POINTS, isAuraEligibleActor } from "../../server-lib/points";
import { captureRequestException } from "../../server-lib/posthog";
import { createR2 } from "../../server-lib/r2";
import { checkRateLimit, RATE_LIMIT_ERROR } from "../../server-lib/ratelimit";
import { registerSchema } from "../../server-lib/schema";
import {
  createSession,
  generateSessionToken,
  invalidateSession,
  invalidateUserSessions,
  resolveSession,
} from "../../server-lib/session";
import {
  deleteSessionCookie,
  setSessionCookie,
} from "../../server-lib/session-cookie";
import type { AppContext } from "./_shared";
import { ctxDb } from "./_shared";

// Auth flows stay OUTSIDE the action() wrapper (FormData/redirect-shaped in
// apps/www). Ported to normal JSON POSTs that return { redirect } | { error };
// the client turns { redirect } into a navigation. Enumeration defense, the
// IP-denylist + auth-rate-limit BEFORE any Argon2 work, and the
// reveal-suspension-only-after-correct-password ordering are all preserved.
// revalidateTag is dropped (cache tags are gone).

const INCORRECT = "Incorrect username or password";

// CSRF: the outer server.ts middleware already guards every non-GET, but these
// handlers don't run through action(), so re-check here too (no session/bearer
// yet on login/signup — a plain Origin===Host check).
function csrfBlocked(c: AppContext): boolean {
  return !passesCsrf(c);
}

export async function loginHandler(c: AppContext): Promise<Response> {
  if (csrfBlocked(c)) return c.json({ error: GENERIC_ERROR }, 403);

  let body: { username?: unknown; password?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: INCORRECT });
  }

  const { username, password } = body;
  const normalizedUsername =
    typeof username === "string" ? username.trim().toLowerCase() : "";

  if (
    typeof username !== "string" ||
    normalizedUsername.length < 5 ||
    normalizedUsername.length > 20 ||
    !/^[a-zA-Z0-9_-]+$/.test(normalizedUsername)
  ) {
    return c.json({ error: INCORRECT });
  }

  if (
    typeof password !== "string" ||
    password.length < 5 ||
    password.length > 255
  ) {
    return c.json({ error: INCORRECT });
  }

  const ip = extractClientIp((n) => c.req.header(n));
  if (await isIpDenied(c.env.KV, ip)) {
    return c.json({ error: ACCESS_BLOCKED_ERROR });
  }
  if (!(await checkRateLimit(c.env, "auth", `login:${ip}`))) {
    return c.json({ error: RATE_LIMIT_ERROR });
  }

  const db = ctxDb(c);

  try {
    const [existingUser] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.username, normalizedUsername))
      .limit(1);

    if (!existingUser?.passwordHash) {
      // Spend comparable Argon2 CPU on the not-found path so response time
      // doesn't reveal which usernames exist (enumeration oracle).
      await hash(password).catch(() => undefined);
      return c.json({ error: INCORRECT });
    }

    const validPassword = await verify(existingUser.passwordHash, password);
    if (!validPassword) {
      return c.json({ error: INCORRECT });
    }

    // Reveal suspension only AFTER a correct password — never before.
    if (existingUser.bannedAt) {
      return c.json({ error: accountSuspendedMessage(existingUser.banReason) });
    }

    const token = generateSessionToken();
    const session = await createSession(db, token, existingUser.id);
    setSessionCookie(c, token, new Date(session.expiresAt));
  } catch (err) {
    console.error("Login error:", formatErrorChain(err));
    captureRequestException(c, err, { properties: { action: "login" } });
    return c.json({ error: "An unexpected error occurred" });
  }

  return c.json({ redirect: "/inbox" });
}

export async function signupHandler(c: AppContext): Promise<Response> {
  if (csrfBlocked(c)) return c.json({ error: GENERIC_ERROR }, 403);

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    raw = undefined;
  }

  const data = (raw ?? {}) as { username?: string };
  const validatedFields = registerSchema.safeParse({
    ...(raw as object),
    username: data.username?.trim().toLowerCase(),
  });

  if (!validatedFields.success) {
    return c.json({ error: "Invalid input" });
  }

  const ip = extractClientIp((n) => c.req.header(n));
  if (await isIpDenied(c.env.KV, ip)) {
    return c.json({ error: ACCESS_BLOCKED_ERROR });
  }
  if (!(await checkRateLimit(c.env, "auth", `signup:${ip}`))) {
    return c.json({ error: RATE_LIMIT_ERROR });
  }

  const passwordHash = await hash(validatedFields.data.password);
  const db = ctxDb(c);

  try {
    const res = await db
      .insert(userTable)
      .values({
        username: validatedFields.data.username.toLowerCase(),
        passwordHash,
      })
      .returning({ id: userTable.id });

    const token = generateSessionToken();
    const session = await createSession(db, token, res[0].id);
    setSessionCookie(c, token, new Date(session.expiresAt));
  } catch (err) {
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
        return c.json({ error: "Username already exists" });
      }
    }
    console.error("Signup error:", formatErrorChain(err));
    captureRequestException(c, err, { properties: { action: "signup" } });
    return c.json({ error: "An unexpected error occurred" });
  }

  return c.json({ redirect: "/inbox" });
}

export async function logoutHandler(c: AppContext): Promise<Response> {
  if (csrfBlocked(c)) return c.json({ error: GENERIC_ERROR }, 403);

  const db = ctxDb(c);
  const { session } = await resolveSession(c, db);

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await invalidateSession(db, session.id);
  deleteSessionCookie(c);
  return c.json({ redirect: "/login" });
}

export async function deleteAccountHandler(c: AppContext): Promise<Response> {
  if (csrfBlocked(c)) return c.json({ error: GENERIC_ERROR }, 403);

  const db = ctxDb(c);
  const { user } = await resolveSession(c, db);

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  let confirmation: unknown;
  try {
    confirmation = ((await c.req.json()) as { confirmation?: unknown })
      .confirmation;
  } catch {
    confirmation = undefined;
  }

  // Enforce the confirmation phrase server-side so a programmatic/CSRF call
  // can't trigger this irreversible delete without the explicit phrase.
  if (
    typeof confirmation !== "string" ||
    confirmation.trim().toLowerCase() !== "delete my account"
  ) {
    return c.json({ error: DELETE_CONFIRMATION_ERROR }, 400);
  }

  if (!(await checkRateLimit(c.env, "auth", `delete-account:${user.id}`))) {
    return c.json({ error: RATE_LIMIT_ERROR }, 429);
  }

  const uid = user.id;

  let postImageRows: { images: PostImage[] | null }[] = [];
  try {
    postImageRows = await db
      .select({ images: postTable.images })
      .from(postTable)
      .where(and(eq(postTable.authorId, uid), isNotNull(postTable.images)));

    await db.transaction(async (tx) => {
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

      if (isAuraEligibleActor(user.createdAt)) {
        await tx
          .update(userTable)
          .set({
            points: sql`CASE WHEN ${userTable.points} >= ${AURA_POINTS.follow} THEN ${userTable.points} - ${AURA_POINTS.follow} ELSE 0 END`,
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
      }

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

      // group_member cascades on user delete; member_count is denormalized and
      // clamped at 0 on leave/kick, so an un-decremented count inflates forever
      // and eventually blocks joins at the cap.
      await tx
        .update(groupTable)
        .set({
          memberCount: sql`CASE WHEN ${groupTable.memberCount} > 0 THEN ${groupTable.memberCount} - 1 ELSE 0 END`,
        })
        .where(
          inArray(
            groupTable.id,
            tx
              .select({ id: groupMemberTable.groupId })
              .from(groupMemberTable)
              .where(eq(groupMemberTable.userId, uid)),
          ),
        );

      // poll_vote cascades too; both denormalized vote counters must follow.
      await tx
        .update(pollOptionTable)
        .set({
          voteCount: sql`CASE WHEN ${pollOptionTable.voteCount} > 0 THEN ${pollOptionTable.voteCount} - 1 ELSE 0 END`,
        })
        .where(
          inArray(
            pollOptionTable.id,
            tx
              .select({ id: pollVoteTable.optionId })
              .from(pollVoteTable)
              .where(eq(pollVoteTable.userId, uid)),
          ),
        );

      await tx
        .update(postTable)
        .set({
          pollVoteCount: sql`CASE WHEN ${postTable.pollVoteCount} > 0 THEN ${postTable.pollVoteCount} - 1 ELSE 0 END`,
        })
        .where(
          inArray(
            postTable.id,
            tx
              .select({ id: pollVoteTable.postId })
              .from(pollVoteTable)
              .where(eq(pollVoteTable.userId, uid)),
          ),
        );

      // The user's quote posts cascade away; the +1 each applied to its quoted
      // post's repost_count is reversed here, mirroring deletePostHandler for a
      // single quote. Counted per quote (like commentCount above) so quoting the
      // same post twice reverses twice.
      const quotes = alias(postTable, "quote");
      await tx
        .update(postTable)
        .set({
          repostCount: sql`MAX(0, ${postTable.repostCount} - (SELECT COUNT(*) FROM ${postTable} AS ${quotes} WHERE ${quotes.quotedPostId} = ${postTable.id} AND ${quotes.authorId} = ${uid}))`,
        })
        .where(
          inArray(
            postTable.id,
            tx
              .select({ id: postTable.quotedPostId })
              .from(postTable)
              .where(
                and(
                  eq(postTable.authorId, uid),
                  isNotNull(postTable.quotedPostId),
                ),
              ),
          ),
        );

      await tx.delete(messageTable).where(eq(messageTable.receiverId, uid));
      await tx.delete(accountTable).where(eq(accountTable.userId, uid));
      await tx.delete(noteTable).where(eq(noteTable.userId, uid));
      await tx.delete(userTable).where(eq(userTable.id, uid));
    });
  } catch (err) {
    // Nothing was removed — reporting the post-delete redirect here would sign
    // the user out believing an irreversible erasure had happened.
    console.error("Account deletion failed:", formatErrorChain(err));
    captureRequestException(c, err, {
      distinctId: uid,
      properties: { action: "deleteAccount", phase: "transaction" },
    });
    return c.json({ error: ACCOUNT_DELETE_FAILED_ERROR }, 500);
  }

  // The row is gone (sessions cascaded with it). Clear this device's cookie and
  // the in-isolate session cache; nothing below may turn success back into an
  // error.
  deleteSessionCookie(c);
  try {
    await invalidateUserSessions(db, uid);
  } catch (err) {
    console.error(
      "Account deletion session cleanup failed:",
      formatErrorChain(err),
    );
    captureRequestException(c, err, {
      distinctId: uid,
      properties: { action: "deleteAccount", phase: "sessions" },
    });
  }

  const r2 = createR2(c.env);
  if (r2) {
    try {
      await r2.deletePostImages(
        postImageRows.flatMap((row) => row.images ?? []),
      );
      await r2.deleteR2Avatar(user.imageUrl);
      await r2.deleteR2Banner(user.bannerImageUrl);
    } catch (err) {
      // Orphaned objects are reclaimed by the bucket lifecycle rule; a falsely
      // reported deletion would not be.
      console.error(
        "Account deletion R2 cleanup failed:",
        formatErrorChain(err),
      );
      captureRequestException(c, err, {
        distinctId: uid,
        properties: { action: "deleteAccount", phase: "r2" },
      });
    }
  }

  return c.json({ redirect: "/login" });
}

// Re-exported so the OAuth callback can mint accounts with the same id shape.
export { generateUsernameId, nanoid };
