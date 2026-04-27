import { createHash } from "node:crypto";
import {
  clearNote,
  createComment,
  createNote,
  createPost,
  createReply,
  deleteAccount,
  deleteMessage,
  deletePost,
  formatUsername,
  GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME,
  GOOGLE_OAUTH_STATE_COOKIE_NAME,
  getCurrentNoteData,
  getCurrentUserData,
  getMessagesPage,
  getNotesPage,
  getPostById,
  getPostCommentsPage,
  getPostsPage,
  getPublicUserProfileData,
  getUserProfileViewerData,
  google,
  loginWithPassword,
  registerSchema,
  sendMessage,
  setBlock,
  setCommentLike,
  setFollow,
  setPostLike,
  setRepost,
  signupWithPassword,
  toggleDisplayPicture,
  toggleQuietMode,
  updateAvatar,
  updateGeneralSettings,
  updatePassword,
} from "@umamin/core";
import {
  createSession,
  deleteSessionTokenCookie,
  generateSessionToken,
  invalidateSession,
  setSessionTokenCookie,
} from "@umamin/core/session";
import { db } from "@umamin/db";
import { accountTable, userTable } from "@umamin/db/schema/user";
import {
  decodeIdToken,
  generateCodeVerifier,
  generateState,
  OAuth2RequestError,
  type OAuth2Tokens,
} from "arctic";
import { and, eq } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { nanoid } from "nanoid";
import * as z from "zod";
import {
  ApiError,
  errorJson,
  mapError,
  parseJson,
  privateNoStore,
  publicCache,
  resultJson,
} from "./http";
import { cookieReader, cookieWriter, getSession } from "./session";

const PUBLIC_CACHE_SECONDS = 120;
const USER_CACHE_SECONDS = 604800;

type AppEnv = {
  Variables: {
    requestId: string;
  };
};

type AppContext = Context<AppEnv>;

const app = new Hono<AppEnv>();

app.use("*", async (c, next) => {
  c.set("requestId", c.req.header("x-request-id") ?? nanoid(10));
  c.header("X-Request-Id", c.get("requestId"));
  await next();
});
app.use("*", logger());
app.use("*", bodyLimit({ maxSize: 1024 * 32 }));

const developmentOrigins =
  process.env.NODE_ENV === "production"
    ? []
    : [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
      ];

const allowedOrigins = [
  process.env.WEB_ORIGIN,
  ...(process.env.CORS_ORIGINS ?? "").split(","),
  ...developmentOrigins,
]
  .map((origin) => origin?.trim())
  .filter((origin): origin is string => !!origin);

if (allowedOrigins.length > 0) {
  app.use(
    "*",
    cors({
      origin: allowedOrigins,
      credentials: true,
    }),
  );
}

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
app.use("*", async (c, next) => {
  if (unsafeMethods.has(c.req.method) && allowedOrigins.length > 0) {
    const origin = c.req.header("Origin");
    if (origin && !allowedOrigins.includes(origin)) {
      throw new ApiError(403, "FORBIDDEN", "Origin not allowed");
    }
  }

  await next();
});

app.onError((err, c) => {
  const mapped = mapError(err);
  if (mapped.status >= 500) {
    console.error("Unhandled API error", {
      requestId: c.get("requestId"),
      path: c.req.path,
      err,
    });
  }
  return errorJson(c, mapped);
});

app.notFound((c) => errorJson(c, new ApiError(404, "NOT_FOUND", "Not found")));

app.get("/health", (c) => c.json({ ok: true }));

const jsonBody = parseJson;

async function requireSession(c: AppContext) {
  const session = await getSession(c);
  if (!session.session) {
    throw new ApiError(401, "UNAUTHORIZED", "Unauthorized");
  }
  return session;
}

function setNewSession(c: AppContext, userId: string) {
  return (async () => {
    const sessionToken = generateSessionToken();
    const session = await createSession(sessionToken, userId);
    setSessionTokenCookie(
      cookieWriter(c),
      sessionToken,
      new Date(session.expiresAt),
    );
  })();
}

function redirect(c: AppContext, location: string) {
  return c.redirect(location, 302);
}

function cookieDomain() {
  return process.env.NODE_ENV === "production"
    ? process.env.SESSION_COOKIE_DOMAIN
    : undefined;
}

function oauthCookieOptions(maxAge: number) {
  return {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge,
    sameSite: "lax" as const,
    domain: cookieDomain(),
  };
}

app.get("/api/auth/session", async (c) => {
  privateNoStore(c);
  const result = await getSession(c);
  if (!result.user) return c.json({ session: null, user: null });
  const { passwordHash: _passwordHash, ...user } = result.user;
  return c.json({ session: result.session, user });
});

app.post("/api/auth/login", async (c) => {
  privateNoStore(c);
  const body = await c.req.parseBody();
  const username = String(body.username ?? "");
  const password = String(body.password ?? "");
  const result = await loginWithPassword(username, password);
  if (!result.success) return resultJson(c, result);
  await setNewSession(c, result.userId);
  return c.json({ success: true });
});

app.post("/api/auth/signup", async (c) => {
  privateNoStore(c);
  const body = registerSchema.parse(await jsonBody(c));
  const result = await signupWithPassword(body);
  if (!result.success) return resultJson(c, result);
  await setNewSession(c, result.userId);
  return c.json({ success: true });
});

app.post("/api/auth/logout", async (c) => {
  privateNoStore(c);
  const result = await requireSession(c);
  await invalidateSession(result.session.id);
  deleteSessionTokenCookie(cookieWriter(c));
  return c.json({ success: true });
});

app.get("/auth/google", (c) => {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url = google.createAuthorizationURL(state, codeVerifier, [
    "openid",
    "profile",
    "email",
  ]);
  const cookies = cookieWriter(c);
  cookies.set(GOOGLE_OAUTH_STATE_COOKIE_NAME, state, {
    ...oauthCookieOptions(60 * 10),
  });
  cookies.set(GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME, codeVerifier, {
    ...oauthCookieOptions(60 * 10),
  });
  return redirect(c, url.toString());
});

const claimsSchema = z.object({
  sub: z.string(),
  picture: z.string(),
  email: z.email(),
});

app.get("/auth/google/callback", async (c) => {
  const code = c.req.query("code") ?? null;
  const state = c.req.query("state") ?? null;
  const cookies = cookieReader(c);
  const storedState = cookies.get(GOOGLE_OAUTH_STATE_COOKIE_NAME) ?? null;
  const codeVerifier =
    cookies.get(GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME) ?? null;
  const writer = cookieWriter(c);

  writer.set(GOOGLE_OAUTH_STATE_COOKIE_NAME, "", {
    ...oauthCookieOptions(0),
  });
  writer.set(GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME, "", {
    ...oauthCookieOptions(0),
  });

  if (
    !code ||
    !state ||
    !storedState ||
    !codeVerifier ||
    state !== storedState
  ) {
    throw new ApiError(400, "BAD_REQUEST", "Invalid OAuth callback");
  }

  let tokens: OAuth2Tokens;
  try {
    tokens = await google.validateAuthorizationCode(code, codeVerifier);
  } catch {
    throw new ApiError(400, "BAD_REQUEST", "Invalid OAuth code");
  }

  try {
    const claims = claimsSchema.parse(decodeIdToken(tokens.idToken()));
    const { user } = await getSession(c);
    const [existingUser] = await db
      .select()
      .from(accountTable)
      .where(
        and(
          eq(accountTable.providerId, "google"),
          eq(accountTable.providerUserId, claims.sub),
        ),
      )
      .limit(1);

    if (user && existingUser)
      return redirect(c, "/settings?error=already_linked");

    if (user) {
      await db
        .update(userTable)
        .set({ imageUrl: claims.picture })
        .where(eq(userTable.id, user.id));
      await db.insert(accountTable).values({
        providerId: "google",
        providerUserId: claims.sub,
        userId: user.id,
        picture: claims.picture,
        email: claims.email,
      });
      return redirect(c, "/settings");
    }

    if (existingUser) {
      await setNewSession(c, existingUser.userId);
      return redirect(c, "/inbox");
    }

    const userId = nanoid();
    await db.insert(userTable).values({
      id: userId,
      imageUrl: claims.picture,
      username: `user_${nanoid(12)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "0")}`,
    });
    await db.insert(accountTable).values({
      providerId: "google",
      providerUserId: claims.sub,
      userId,
      picture: claims.picture,
      email: claims.email,
    });
    await setNewSession(c, userId);
    return redirect(c, "/inbox");
  } catch (err) {
    if (err instanceof OAuth2RequestError) {
      throw new ApiError(400, "BAD_REQUEST", "OAuth request failed");
    }
    throw err;
  }
});

app.get("/api/public/posts", async (c) => {
  publicCache(c, PUBLIC_CACHE_SECONDS);
  return c.json(await getPostsPage({ cursor: c.req.query("cursor") ?? null }));
});

app.get("/api/posts", async (c) => {
  const session = await getSession(c);
  return c.json(
    await getPostsPage({
      cursor: c.req.query("cursor") ?? null,
      viewerId: session.session?.userId,
    }),
  );
});

app.post("/api/posts", async (c) =>
  resultJson(c, await createPost(await requireSession(c), await jsonBody(c))),
);
app.delete("/api/posts/:id", async (c) =>
  resultJson(c, await deletePost(await requireSession(c), c.req.param("id"))),
);
app.post("/api/posts/:id/comments", async (c) => {
  const body = await jsonBody(c);
  return resultJson(
    c,
    await createComment(await requireSession(c), {
      ...body,
      postId: c.req.param("id"),
    }),
  );
});
app.post("/api/posts/:id/like", async (c) =>
  resultJson(
    c,
    await setPostLike(await requireSession(c), c.req.param("id"), true),
  ),
);
app.delete("/api/posts/:id/like", async (c) =>
  resultJson(
    c,
    await setPostLike(await requireSession(c), c.req.param("id"), false),
  ),
);
app.post("/api/posts/:id/repost", async (c) =>
  resultJson(
    c,
    await setRepost(
      await requireSession(c),
      { ...(await jsonBody(c)), postId: c.req.param("id") },
      true,
    ),
  ),
);
app.delete("/api/posts/:id/repost", async (c) =>
  resultJson(
    c,
    await setRepost(
      await requireSession(c),
      { postId: c.req.param("id") },
      false,
    ),
  ),
);

app.get("/api/public/posts/:id", async (c) => {
  publicCache(c, PUBLIC_CACHE_SECONDS);
  const result = await getPostById({ postId: c.req.param("id") });
  if (!result) throw new ApiError(404, "NOT_FOUND", "Not found");
  return c.json(result);
});

app.get("/api/posts/:id", async (c) => {
  const session = await getSession(c);
  return c.json(
    await getPostById({
      postId: c.req.param("id"),
      viewerId: session.session?.userId,
    }),
  );
});

app.get("/api/public/posts/:id/comments", async (c) => {
  publicCache(c, PUBLIC_CACHE_SECONDS);
  return c.json(
    await getPostCommentsPage({
      postId: c.req.param("id"),
      cursor: c.req.query("cursor") ?? null,
    }),
  );
});

app.get("/api/posts/:id/comments", async (c) => {
  const session = await getSession(c);
  return c.json(
    await getPostCommentsPage({
      postId: c.req.param("id"),
      cursor: c.req.query("cursor") ?? null,
      viewerId: session.session?.userId,
    }),
  );
});

app.post("/api/comments/:id/like", async (c) =>
  resultJson(
    c,
    await setCommentLike(await requireSession(c), c.req.param("id"), true),
  ),
);
app.delete("/api/comments/:id/like", async (c) =>
  resultJson(
    c,
    await setCommentLike(await requireSession(c), c.req.param("id"), false),
  ),
);

app.get("/api/public/notes", async (c) => {
  publicCache(c, PUBLIC_CACHE_SECONDS);
  return c.json(await getNotesPage({ cursor: c.req.query("cursor") ?? null }));
});

app.get("/api/notes", async (c) => {
  const session = await getSession(c);
  return c.json(
    await getNotesPage({
      cursor: c.req.query("cursor") ?? null,
      viewerId: session.session?.userId,
    }),
  );
});
app.post("/api/notes", async (c) =>
  resultJson(c, await createNote(await requireSession(c), await jsonBody(c))),
);
app.delete("/api/notes/current", async (c) =>
  resultJson(c, await clearNote(await requireSession(c))),
);
app.get("/api/notes/current", async (c) => {
  privateNoStore(c);
  const session = await requireSession(c);
  return c.json(await getCurrentNoteData(session.session.userId));
});

app.get("/api/me", async (c) => {
  privateNoStore(c);
  const session = await requireSession(c);
  return c.json(await getCurrentUserData(session.session.userId));
});

app.get("/api/messages", async (c) => {
  privateNoStore(c);
  const session = await requireSession(c);
  const type = c.req.query("type") === "sent" ? "sent" : "received";
  return c.json(
    await getMessagesPage({
      type,
      cursor: c.req.query("cursor") ?? null,
      userId: session.session.userId,
    }),
  );
});
app.post("/api/messages", async (c) =>
  resultJson(c, await sendMessage(await getSession(c), await jsonBody(c))),
);
app.delete("/api/messages/:id", async (c) =>
  resultJson(
    c,
    await deleteMessage(await requireSession(c), c.req.param("id")),
  ),
);
app.post("/api/messages/:id/reply", async (c) =>
  resultJson(
    c,
    await createReply(await requireSession(c), {
      ...(await jsonBody(c)),
      messageId: c.req.param("id"),
    }),
  ),
);

app.get("/api/public/user/:username", async (c) => {
  publicCache(c, USER_CACHE_SECONDS);
  const result = await getPublicUserProfileData(
    formatUsername(c.req.param("username")),
  );
  if (!result) throw new ApiError(404, "NOT_FOUND", "Not found");
  return c.json(result);
});
app.get("/api/user/:username", async (c) => {
  const result = await getPublicUserProfileData(
    formatUsername(c.req.param("username")),
  );
  if (!result) throw new ApiError(404, "NOT_FOUND", "Not found");
  return c.json(result);
});
app.get("/api/user/:username/viewer", async (c) => {
  privateNoStore(c);
  const session = await getSession(c);
  const result = await getUserProfileViewerData(
    formatUsername(c.req.param("username")),
    session.session?.userId,
  );
  if (!result) throw new ApiError(404, "NOT_FOUND", "Not found");
  return c.json(result);
});

app.get("/api/gravatar", async (c) => {
  privateNoStore(c);
  await requireSession(c);
  const email = c.req.query("email")?.trim().toLowerCase();

  if (!email || !z.email().safeParse(email).success) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid email address");
  }

  const hash = createHash("md5").update(email).digest("hex");
  const previewUrl = new URL(`https://www.gravatar.com/avatar/${hash}`);
  previewUrl.searchParams.set("s", "256");
  previewUrl.searchParams.set("r", "pg");
  previewUrl.searchParams.set("d", "404");

  const response = await fetch(previewUrl, { method: "GET" });
  if (!response.ok) {
    throw new ApiError(404, "NOT_FOUND", "No Gravatar found for that email");
  }

  previewUrl.searchParams.set("d", "mp");
  return c.json({ url: previewUrl.toString() });
});

app.patch("/api/settings/general", async (c) =>
  resultJson(
    c,
    await updateGeneralSettings(await requireSession(c), await jsonBody(c)),
  ),
);
app.patch("/api/settings/password", async (c) =>
  resultJson(
    c,
    await updatePassword(await requireSession(c), await jsonBody(c)),
  ),
);
app.patch("/api/settings/display-picture", async (c) =>
  resultJson(
    c,
    await toggleDisplayPicture(
      await requireSession(c),
      (await jsonBody(c)).accountImgUrl,
    ),
  ),
);
app.patch("/api/settings/quiet-mode", async (c) =>
  resultJson(c, await toggleQuietMode(await requireSession(c))),
);
app.patch("/api/settings/avatar", async (c) =>
  resultJson(
    c,
    await updateAvatar(
      await requireSession(c),
      String((await jsonBody(c)).imageUrl ?? ""),
    ),
  ),
);
app.delete("/api/account", async (c) => {
  const result = await deleteAccount(await requireSession(c));
  await invalidateSession(result.sessionId);
  deleteSessionTokenCookie(cookieWriter(c));
  return c.json({ success: true });
});
app.post("/api/users/:id/follow", async (c) =>
  resultJson(
    c,
    await setFollow(await requireSession(c), c.req.param("id"), true),
  ),
);
app.delete("/api/users/:id/follow", async (c) =>
  resultJson(
    c,
    await setFollow(await requireSession(c), c.req.param("id"), false),
  ),
);
app.post("/api/users/:id/block", async (c) =>
  resultJson(
    c,
    await setBlock(await requireSession(c), c.req.param("id"), true),
  ),
);
app.delete("/api/users/:id/block", async (c) =>
  resultJson(
    c,
    await setBlock(await requireSession(c), c.req.param("id"), false),
  ),
);

export { app };
