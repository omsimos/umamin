import { createHash } from "node:crypto";
import {
  formatUsername,
  getCurrentUserData,
  getPublicUserProfileData,
  getUserProfileViewerData,
  setBlock,
  setFollow,
} from "@umamin/core";
import { Hono } from "hono";
import * as z from "zod";
import { USER_CACHE_SECONDS } from "../config";
import { requireSession } from "../context";
import { ApiError, privateNoStore, publicCache, resultJson } from "../http";
import { getSession } from "../session";
import type { AppEnv } from "../types";

export const userRoutes = new Hono<AppEnv>();

userRoutes.get("/api/me", async (c) => {
  privateNoStore(c);
  const session = await requireSession(c);
  return c.json(await getCurrentUserData(session.session.userId));
});

userRoutes.get("/api/public/user/:username", async (c) => {
  publicCache(c, USER_CACHE_SECONDS);
  const result = await getPublicUserProfileData(
    formatUsername(c.req.param("username")),
  );
  if (!result) throw new ApiError(404, "NOT_FOUND", "Not found");
  return c.json(result);
});

userRoutes.get("/api/user/:username", async (c) => {
  publicCache(c, USER_CACHE_SECONDS);
  const result = await getPublicUserProfileData(
    formatUsername(c.req.param("username")),
  );
  if (!result) throw new ApiError(404, "NOT_FOUND", "Not found");
  return c.json(result);
});

userRoutes.get("/api/user/:username/viewer", async (c) => {
  privateNoStore(c);
  const session = await getSession(c);
  const result = await getUserProfileViewerData(
    formatUsername(c.req.param("username")),
    session.session?.userId,
  );
  if (!result) throw new ApiError(404, "NOT_FOUND", "Not found");
  return c.json(result);
});

userRoutes.get("/api/gravatar", async (c) => {
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

userRoutes.post("/api/users/:id/follow", async (c) =>
  resultJson(
    c,
    await setFollow(await requireSession(c), c.req.param("id"), true),
  ),
);

userRoutes.delete("/api/users/:id/follow", async (c) =>
  resultJson(
    c,
    await setFollow(await requireSession(c), c.req.param("id"), false),
  ),
);

userRoutes.post("/api/users/:id/block", async (c) =>
  resultJson(
    c,
    await setBlock(await requireSession(c), c.req.param("id"), true),
  ),
);

userRoutes.delete("/api/users/:id/block", async (c) =>
  resultJson(
    c,
    await setBlock(await requireSession(c), c.req.param("id"), false),
  ),
);
