import {
  createComment,
  createPost,
  deletePost,
  getPostById,
  getPostCommentsPage,
  getPostsPage,
  setCommentLike,
  setPostLike,
  setRepost,
} from "@umamin/core";
import { Hono } from "hono";
import { PUBLIC_CACHE_SECONDS } from "../config";
import { jsonBody, requireSession } from "../context";
import { ApiError, privateNoStore, publicCache, resultJson } from "../http";
import { getSession } from "../session";
import type { AppEnv } from "../types";

export const postRoutes = new Hono<AppEnv>();

postRoutes.get("/api/public/posts", async (c) => {
  publicCache(c, PUBLIC_CACHE_SECONDS);
  return c.json(await getPostsPage({ cursor: c.req.query("cursor") ?? null }));
});

postRoutes.get("/api/posts", async (c) => {
  privateNoStore(c);
  const session = await getSession(c);
  return c.json(
    await getPostsPage({
      cursor: c.req.query("cursor") ?? null,
      viewerId: session.session?.userId,
    }),
  );
});

postRoutes.post("/api/posts", async (c) =>
  resultJson(c, await createPost(await requireSession(c), await jsonBody(c))),
);

postRoutes.delete("/api/posts/:id", async (c) =>
  resultJson(c, await deletePost(await requireSession(c), c.req.param("id"))),
);

postRoutes.post("/api/posts/:id/comments", async (c) => {
  const body = await jsonBody(c);
  return resultJson(
    c,
    await createComment(await requireSession(c), {
      ...body,
      postId: c.req.param("id"),
    }),
  );
});

postRoutes.post("/api/posts/:id/like", async (c) =>
  resultJson(
    c,
    await setPostLike(await requireSession(c), c.req.param("id"), true),
  ),
);

postRoutes.delete("/api/posts/:id/like", async (c) =>
  resultJson(
    c,
    await setPostLike(await requireSession(c), c.req.param("id"), false),
  ),
);

postRoutes.post("/api/posts/:id/repost", async (c) =>
  resultJson(
    c,
    await setRepost(
      await requireSession(c),
      { ...(await jsonBody(c)), postId: c.req.param("id") },
      true,
    ),
  ),
);

postRoutes.delete("/api/posts/:id/repost", async (c) =>
  resultJson(
    c,
    await setRepost(
      await requireSession(c),
      { postId: c.req.param("id") },
      false,
    ),
  ),
);

postRoutes.get("/api/public/posts/:id", async (c) => {
  publicCache(c, PUBLIC_CACHE_SECONDS);
  const result = await getPostById({ postId: c.req.param("id") });
  if (!result) throw new ApiError(404, "NOT_FOUND", "Not found");
  return c.json(result);
});

postRoutes.get("/api/posts/:id", async (c) => {
  privateNoStore(c);
  const session = await getSession(c);
  return c.json(
    await getPostById({
      postId: c.req.param("id"),
      viewerId: session.session?.userId,
    }),
  );
});

postRoutes.get("/api/public/posts/:id/comments", async (c) => {
  publicCache(c, PUBLIC_CACHE_SECONDS);
  return c.json(
    await getPostCommentsPage({
      postId: c.req.param("id"),
      cursor: c.req.query("cursor") ?? null,
    }),
  );
});

postRoutes.get("/api/posts/:id/comments", async (c) => {
  privateNoStore(c);
  const session = await getSession(c);
  return c.json(
    await getPostCommentsPage({
      postId: c.req.param("id"),
      cursor: c.req.query("cursor") ?? null,
      viewerId: session.session?.userId,
    }),
  );
});

postRoutes.post("/api/comments/:id/like", async (c) =>
  resultJson(
    c,
    await setCommentLike(await requireSession(c), c.req.param("id"), true),
  ),
);

postRoutes.delete("/api/comments/:id/like", async (c) =>
  resultJson(
    c,
    await setCommentLike(await requireSession(c), c.req.param("id"), false),
  ),
);
