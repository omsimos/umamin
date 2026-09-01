import { beforeEach, describe, expect, it, vi } from "vitest";

// argon2's precompiled .wasm import only resolves in the workers pool; these
// node-pool suites pull argon2 in transitively via actionsApp but never call it.
vi.mock("../src/server-lib/argon2", () => ({
  hash: async () => "",
  verify: async () => false,
}));

import { postLikeTable, postTable } from "@umamin/db/schema/post";
import { userBlockTable, userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import type { Db } from "../src/server-lib/db";
import { __clearSessionCache } from "../src/server-lib/session";
import { authed, buildApp, callJson } from "./helpers/actions";
import { makeTestDb } from "./helpers/db";

// Aura is only awarded from an actor whose account is older than the 3-day gate.
const OLD = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

async function seedUser(
  db: Db,
  id: string,
  extra: Record<string, unknown> = {},
) {
  await db.insert(userTable).values({ id, username: `u_${id}`, ...extra });
}

async function seedPost(db: Db, id: string, authorId: string) {
  await db.insert(postTable).values({ id, content: "hello", authorId });
}

async function points(db: Db, id: string) {
  const [row] = await db
    .select({ points: userTable.points })
    .from(userTable)
    .where(eq(userTable.id, id));
  return row.points;
}

describe("post actions (real libSQL)", () => {
  let db: Db;

  beforeEach(async () => {
    __clearSessionCache();
    db = await makeTestDb();
    await seedUser(db, "author");
    await seedUser(db, "viewer");
    await seedPost(db, "p1", "author");
  });

  it("addLikeAction increments likeCount and awards aura to the author", async () => {
    const app = buildApp(db, authed("viewer", { createdAt: OLD }));
    const { json } = await callJson(app, "addLikeAction", { postId: "p1" });

    expect(json).toEqual({ success: true });
    const [post] = await db
      .select({ likeCount: postTable.likeCount })
      .from(postTable)
      .where(eq(postTable.id, "p1"));
    expect(post.likeCount).toBe(1);
    expect(await points(db, "author")).toBe(2);
  });

  it("a duplicate like is a no-op (alreadyLiked) and doesn't double-count", async () => {
    const app = buildApp(db, authed("viewer", { createdAt: OLD }));
    await callJson(app, "addLikeAction", { postId: "p1" });
    const { json } = await callJson(app, "addLikeAction", { postId: "p1" });

    expect(json).toEqual({ success: true, alreadyLiked: true });
    expect(await points(db, "author")).toBe(2);
  });

  it("a self-like counts but awards the author no aura", async () => {
    const app = buildApp(db, authed("author", { createdAt: OLD }));
    const { json } = await callJson(app, "addLikeAction", { postId: "p1" });

    expect(json).toEqual({ success: true });
    const [post] = await db
      .select({ likeCount: postTable.likeCount })
      .from(postTable)
      .where(eq(postTable.id, "p1"));
    expect(post.likeCount).toBe(1);
    expect(await points(db, "author")).toBe(0);
  });

  // The batched award resolves the author by subquery, so the block probe
  // correlates on the row being updated rather than a JS-side literal.
  it("a like from a blocked user counts but awards no aura", async () => {
    await db
      .insert(userBlockTable)
      .values({ blockerId: "author", blockedId: "viewer" });
    const app = buildApp(db, authed("viewer", { createdAt: OLD }));
    const { json } = await callJson(app, "addLikeAction", { postId: "p1" });

    expect(json).toEqual({ success: true });
    const [post] = await db
      .select({ likeCount: postTable.likeCount })
      .from(postTable)
      .where(eq(postTable.id, "p1"));
    expect(post.likeCount).toBe(1);
    expect(await points(db, "author")).toBe(0);
  });

  it("a like from an under-age actor counts but awards no aura", async () => {
    const app = buildApp(db, authed("viewer", { createdAt: new Date() }));
    const { json } = await callJson(app, "addLikeAction", { postId: "p1" });

    expect(json).toEqual({ success: true });
    const [post] = await db
      .select({ likeCount: postTable.likeCount })
      .from(postTable)
      .where(eq(postTable.id, "p1"));
    expect(post.likeCount).toBe(1);
    expect(await points(db, "author")).toBe(0);
  });

  it("removeLikeAction reverses the like and the aura", async () => {
    const app = buildApp(db, authed("viewer", { createdAt: OLD }));
    await callJson(app, "addLikeAction", { postId: "p1" });
    const { json } = await callJson(app, "removeLikeAction", { postId: "p1" });

    expect(json).toEqual({ success: true });
    const rows = await db
      .select()
      .from(postLikeTable)
      .where(eq(postLikeTable.postId, "p1"));
    expect(rows).toHaveLength(0);
    expect(await points(db, "author")).toBe(0);
  });

  it("unliking a post the viewer never liked leaves the count alone", async () => {
    await db
      .update(postTable)
      .set({ likeCount: 3 })
      .where(eq(postTable.id, "p1"));
    const app = buildApp(db, authed("viewer", { createdAt: OLD }));
    const { json } = await callJson(app, "removeLikeAction", { postId: "p1" });

    expect(json).toEqual({ success: true, alreadyRemoved: true });
    const [post] = await db
      .select({ likeCount: postTable.likeCount })
      .from(postTable)
      .where(eq(postTable.id, "p1"));
    expect(post.likeCount).toBe(3);
  });

  it("createCommentAction bumps commentCount and awards first-comment aura", async () => {
    const app = buildApp(db, authed("viewer", { createdAt: OLD }));
    const { json } = await callJson<{ success: boolean }>(
      app,
      "createCommentAction",
      { postId: "p1", content: "nice" },
    );

    expect(json.success).toBe(true);
    const [post] = await db
      .select({ commentCount: postTable.commentCount })
      .from(postTable)
      .where(eq(postTable.id, "p1"));
    expect(post.commentCount).toBe(1);
    expect(await points(db, "author")).toBe(5);
  });

  it("deletePostAction refuses a non-owner non-moderator", async () => {
    const app = buildApp(db, authed("viewer", { createdAt: OLD }));
    const { json } = await callJson(app, "deletePostAction", { postId: "p1" });
    expect(json).toEqual({ error: "Post not found" });
  });

  it("deletePostAction lets the owner delete their post", async () => {
    const app = buildApp(db, authed("author", { createdAt: OLD }));
    const { json } = await callJson(app, "deletePostAction", { postId: "p1" });
    expect(json).toEqual({ success: true });
    const rows = await db
      .select()
      .from(postTable)
      .where(eq(postTable.id, "p1"));
    expect(rows).toHaveLength(0);
  });

  it("pin then unpin toggles the user's pinnedPostId", async () => {
    const app = buildApp(db, authed("author", { createdAt: OLD }));
    await callJson(app, "pinPostAction", { postId: "p1" });
    let [u] = await db
      .select({ pinnedPostId: userTable.pinnedPostId })
      .from(userTable)
      .where(eq(userTable.id, "author"));
    expect(u.pinnedPostId).toBe("p1");

    await callJson(app, "unpinPostAction", {});
    [u] = await db
      .select({ pinnedPostId: userTable.pinnedPostId })
      .from(userTable)
      .where(eq(userTable.id, "author"));
    expect(u.pinnedPostId).toBeNull();
  });

  it("rejects a cross-origin cookie mutation (CSRF) with 403", async () => {
    const app = buildApp(db, authed("viewer", { createdAt: OLD }));
    const res = await app.request("/actions/addLikeAction", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.test",
        host: "x.test",
      },
      body: JSON.stringify({ postId: "p1" }),
    });
    expect(res.status).toBe(403);
  });
});
