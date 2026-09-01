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
  userFollowTable,
  userTable,
} from "@umamin/db/schema/user";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { hash, verify } from "../../server-lib/argon2";
import { generateUsernameId } from "../../server-lib/content";
import { passesCsrf } from "../../server-lib/csrf";
import {
  ACCESS_BLOCKED_ERROR,
  accountSuspendedMessage,
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
    return c.json({ redirect: "/settings?error=invalid_confirmation" });
  }

  if (!(await checkRateLimit(c.env, "auth", `delete-account:${user.id}`))) {
    return c.json({ redirect: "/settings?error=rate_limited" });
  }

  try {
    const uid = user.id;

    const postImageRows = await db
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

      await tx.delete(messageTable).where(eq(messageTable.receiverId, uid));
      await tx.delete(accountTable).where(eq(accountTable.userId, uid));
      await tx.delete(noteTable).where(eq(noteTable.userId, uid));
      await tx.delete(userTable).where(eq(userTable.id, uid));
    });

    // Cookie first — if the cleanup below throws, this device must not keep a
    // live-looking cookie. invalidateUserSessions clears the in-isolate session
    // cache so other devices stop validating immediately (rows already cascade-
    // gone with the user row).
    deleteSessionCookie(c);
    await invalidateUserSessions(db, uid);

    const r2 = createR2(c.env);
    if (r2) {
      await r2.deletePostImages(
        postImageRows.flatMap((row) => row.images ?? []),
      );
      await r2.deleteR2Avatar(user.imageUrl);
      await r2.deleteR2Banner(user.bannerImageUrl);
    }
  } catch (err) {
    console.error("Account deletion cleanup failed:", formatErrorChain(err));
    captureRequestException(c, err, {
      distinctId: user.id,
      properties: { action: "deleteAccount" },
    });
  }

  return c.json({ redirect: "/login" });
}

// Re-exported so the OAuth callback can mint accounts with the same id shape.
export { generateUsernameId, nanoid };
