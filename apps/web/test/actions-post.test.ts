import { beforeEach, describe, expect, it, vi } from "vitest";

// argon2's precompiled .wasm import only resolves in the workers pool; these
// node-pool suites pull argon2 in transitively via actionsApp but never call it.
vi.mock("../src/server-lib/argon2", () => ({
  hash: async () => "",
  verify: async () => false,
}));

// Real classifier by default (no AI key, so it fails open); a test can swap in
// an implementation to act during the classifier await.
const { classifyContent } = vi.hoisted(() => ({ classifyContent: vi.fn() }));
vi.mock("../src/server-lib/content-classifier", async (importActual) => {
  const actual =
    await importActual<typeof import("../src/server-lib/content-classifier")>();
  classifyContent.mockImplementation(actual.classifyContent);
  return { ...actual, classifyContent };
});

import { moderationDisputeTable } from "@umamin/db/schema/moderation-dispute";
import { noteReactionTable, noteTable } from "@umamin/db/schema/note";
import { notificationTable } from "@umamin/db/schema/notification";
import {
  pollOptionTable,
  pollVoteTable,
  postCommentLikeTable,
  postCommentTable,
  postLikeTable,
  postRepostTable,
  postTable,
} from "@umamin/db/schema/post";
import { userBlockTable, userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import type { Db } from "../src/server-lib/db";
import { RATE_LIMIT_ERROR } from "../src/server-lib/ratelimit";
import { __clearSessionCache } from "../src/server-lib/session";
import { ANON, authed, buildApp, callJson } from "./helpers/actions";
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

  it.each(["getPostAction", "getPostPublicAction"])(
    "%s is rate-limited per IP",
    async (name) => {
      const app = buildApp(db, ANON);
      const refuse = { limit: async () => ({ success: false }) };
      const { json } = await callJson(app, name, { id: "p1" }, {
        RL_READ: refuse,
      } as never);
      expect(json).toEqual({ error: RATE_LIMIT_ERROR });
    },
  );

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

  // The block gate lives inside the batched insert, so it correlates on the
  // post row rather than a JS-side literal.
  it.each([
    ["author blocked the viewer", "author", "viewer"],
    ["viewer blocked the author", "viewer", "author"],
  ])(
    "a like across a block (%s) is refused and writes nothing",
    async (_label, blockerId, blockedId) => {
      await db.insert(userBlockTable).values({ blockerId, blockedId });
      const app = buildApp(db, authed("viewer", { createdAt: OLD }));
      const { json } = await callJson(app, "addLikeAction", { postId: "p1" });

      expect(json).toEqual({ error: "Post not found" });
      const [post] = await db
        .select({ likeCount: postTable.likeCount })
        .from(postTable)
        .where(eq(postTable.id, "p1"));
      expect(post.likeCount).toBe(0);
      expect(await db.select().from(postLikeTable)).toHaveLength(0);
      expect(await db.select().from(notificationTable)).toHaveLength(0);
      expect(await points(db, "author")).toBe(0);
    },
  );

  it("liking a post that doesn't exist is reported as not found", async () => {
    const app = buildApp(db, authed("viewer", { createdAt: OLD }));
    const { json } = await callJson(app, "addLikeAction", { postId: "nope" });

    expect(json).toEqual({ error: "Post not found" });
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

  it("only the first comment on a post awards aura", async () => {
    const app = buildApp(db, authed("viewer", { createdAt: OLD }));
    await callJson(app, "createCommentAction", {
      postId: "p1",
      content: "first",
    });
    const { json } = await callJson<{ success: boolean }>(
      app,
      "createCommentAction",
      { postId: "p1", content: "second" },
    );

    expect(json.success).toBe(true);
    const [post] = await db
      .select({ commentCount: postTable.commentCount })
      .from(postTable)
      .where(eq(postTable.id, "p1"));
    expect(post.commentCount).toBe(2);
    expect(await points(db, "author")).toBe(5);
    expect(await db.select().from(notificationTable)).toHaveLength(1);
  });

  it("a comment on a missing post is reported as not found", async () => {
    const app = buildApp(db, authed("viewer", { createdAt: OLD }));
    const { json } = await callJson(app, "createCommentAction", {
      postId: "nope",
      content: "hi",
    });

    expect(json).toEqual({ error: "Post not found" });
  });

  describe("poll votes", () => {
    beforeEach(async () => {
      await db
        .update(postTable)
        .set({ pollEndsAt: new Date(Date.now() + 60 * 60 * 1000) })
        .where(eq(postTable.id, "p1"));
      await db.insert(pollOptionTable).values([
        { id: "o1", postId: "p1", idx: 0, label: "yes" },
        { id: "o2", postId: "p1", idx: 1, label: "no" },
      ]);
    });

    async function counts() {
      const options = await db
        .select({
          id: pollOptionTable.id,
          voteCount: pollOptionTable.voteCount,
        })
        .from(pollOptionTable);
      const [post] = await db
        .select({ pollVoteCount: postTable.pollVoteCount })
        .from(postTable)
        .where(eq(postTable.id, "p1"));
      return {
        o1: options.find((o) => o.id === "o1")?.voteCount,
        o2: options.find((o) => o.id === "o2")?.voteCount,
        total: post.pollVoteCount,
      };
    }

    it("votePollAction counts the vote, awards aura and notifies", async () => {
      const app = buildApp(db, authed("viewer", { createdAt: OLD }));
      const { json } = await callJson(app, "votePollAction", {
        optionId: "o1",
      });

      expect(json).toEqual({ success: true, votedOptionId: "o1" });
      expect(await counts()).toEqual({ o1: 1, o2: 0, total: 1 });
      expect(await points(db, "author")).toBe(1);
      expect(await db.select().from(notificationTable)).toHaveLength(1);
    });

    it("a second vote returns the original choice and counts nothing", async () => {
      const app = buildApp(db, authed("viewer", { createdAt: OLD }));
      await callJson(app, "votePollAction", { optionId: "o1" });
      const { json } = await callJson(app, "votePollAction", {
        optionId: "o2",
      });

      expect(json).toEqual({
        success: true,
        alreadyVoted: true,
        votedOptionId: "o1",
      });
      expect(await counts()).toEqual({ o1: 1, o2: 0, total: 1 });
      expect(await points(db, "author")).toBe(1);
      expect(await db.select().from(pollVoteTable)).toHaveLength(1);
    });

    it("a self vote counts but awards no aura", async () => {
      const app = buildApp(db, authed("author", { createdAt: OLD }));
      await callJson(app, "votePollAction", { optionId: "o1" });

      expect(await counts()).toEqual({ o1: 1, o2: 0, total: 1 });
      expect(await points(db, "author")).toBe(0);
    });

    it("a vote across a block still counts but awards no aura or notification", async () => {
      await db
        .insert(userBlockTable)
        .values({ blockerId: "author", blockedId: "viewer" });
      const app = buildApp(db, authed("viewer", { createdAt: OLD }));
      await callJson(app, "votePollAction", { optionId: "o1" });

      expect(await counts()).toEqual({ o1: 1, o2: 0, total: 1 });
      expect(await points(db, "author")).toBe(0);
      expect(await db.select().from(notificationTable)).toHaveLength(0);
    });
  });

  it("a comment from a blocked user is rejected as not found and writes nothing", async () => {
    await db
      .insert(userBlockTable)
      .values({ blockerId: "author", blockedId: "viewer" });
    const app = buildApp(db, authed("viewer", { createdAt: OLD }));
    const { json } = await callJson(app, "createCommentAction", {
      postId: "p1",
      content: "hi",
    });

    expect(json).toEqual({ error: "Post not found" });
    expect(await db.select().from(postCommentTable)).toHaveLength(0);
    const [post] = await db
      .select({ commentCount: postTable.commentCount })
      .from(postTable)
      .where(eq(postTable.id, "p1"));
    expect(post.commentCount).toBe(0);
    expect(await db.select().from(notificationTable)).toHaveLength(0);
  });

  it("a like from a non-blocked user still notifies the author", async () => {
    const app = buildApp(db, authed("viewer", { createdAt: OLD }));
    await callJson(app, "addLikeAction", { postId: "p1" });

    expect(await db.select().from(notificationTable)).toHaveLength(1);
  });

  // Aura is reversed without a block check, so an engagement row written across
  // a block (no award) must never exist: block → engage → unblock → undo would
  // otherwise subtract aura the author was never granted.
  describe("aura drain across block → engage → unblock → undo", () => {
    beforeEach(async () => {
      await db
        .update(userTable)
        .set({ points: 100 })
        .where(eq(userTable.id, "author"));
    });

    async function block() {
      await db
        .insert(userBlockTable)
        .values({ blockerId: "author", blockedId: "viewer" });
    }
    async function unblock() {
      await db.delete(userBlockTable);
    }

    it("like", async () => {
      const app = buildApp(db, authed("viewer", { createdAt: OLD }));
      await block();
      const add = await callJson(app, "addLikeAction", { postId: "p1" });
      expect(add.json).toHaveProperty("error");
      await unblock();
      await callJson(app, "removeLikeAction", { postId: "p1" });

      expect(await points(db, "author")).toBe(100);
    });

    it("repost", async () => {
      const app = buildApp(db, authed("viewer", { createdAt: OLD }));
      await block();
      const add = await callJson(app, "addRepostAction", { postId: "p1" });
      expect(add.json).toEqual({ error: "Post not found" });
      expect(await db.select().from(postRepostTable)).toHaveLength(0);
      await unblock();
      await callJson(app, "removeRepostAction", { postId: "p1" });

      expect(await points(db, "author")).toBe(100);
    });

    it("comment like", async () => {
      await db
        .insert(postCommentTable)
        .values({ id: "c1", postId: "p1", authorId: "author", content: "hi" });
      const app = buildApp(db, authed("viewer", { createdAt: OLD }));
      await block();
      const add = await callJson(app, "addCommentLikeAction", {
        commentId: "c1",
      });
      expect(add.json).toEqual({ error: "Comment not found" });
      expect(await db.select().from(postCommentLikeTable)).toHaveLength(0);
      await unblock();
      await callJson(app, "removeCommentLikeAction", { commentId: "c1" });

      expect(await points(db, "author")).toBe(100);
    });

    it("quote", async () => {
      const app = buildApp(db, authed("viewer", { createdAt: OLD }));
      await block();
      const { json } = await callJson(app, "createPostAction", {
        content: "q",
        quotedPostId: "p1",
      });

      expect(json).toEqual({
        error: "The post you're quoting is no longer available.",
      });
      const posts = await db.select({ id: postTable.id }).from(postTable);
      expect(posts).toEqual([{ id: "p1" }]);
      const [post] = await db
        .select({ repostCount: postTable.repostCount })
        .from(postTable)
        .where(eq(postTable.id, "p1"));
      expect(post.repostCount).toBe(0);
      expect(await points(db, "author")).toBe(100);
    });

    it("an unblocked like → unlike still nets out to zero", async () => {
      const app = buildApp(db, authed("viewer", { createdAt: OLD }));
      await callJson(app, "addLikeAction", { postId: "p1" });
      expect(await points(db, "author")).toBe(102);
      await callJson(app, "removeLikeAction", { postId: "p1" });

      expect(await points(db, "author")).toBe(100);
    });

    it("a repeat repost and a repeat comment like stay no-ops", async () => {
      await db
        .insert(postCommentTable)
        .values({ id: "c1", postId: "p1", authorId: "author", content: "hi" });
      const app = buildApp(db, authed("viewer", { createdAt: OLD }));
      await callJson(app, "addRepostAction", { postId: "p1" });
      await callJson(app, "addCommentLikeAction", { commentId: "c1" });
      const repost = await callJson(app, "addRepostAction", { postId: "p1" });
      const like = await callJson(app, "addCommentLikeAction", {
        commentId: "c1",
      });

      expect(repost.json).toEqual({ success: true, alreadyReposted: true });
      expect(like.json).toEqual({ success: true, alreadyLiked: true });
      expect(await points(db, "author")).toBe(104);
    });

    it("a missing post or comment is reported as not found", async () => {
      const app = buildApp(db, authed("viewer", { createdAt: OLD }));
      const repost = await callJson(app, "addRepostAction", { postId: "nope" });
      const like = await callJson(app, "addCommentLikeAction", {
        commentId: "nope",
      });

      expect(repost.json).toEqual({ error: "Post not found" });
      expect(like.json).toEqual({ error: "Comment not found" });
    });
  });

  describe("reposts and comment likes", () => {
    async function repostCount() {
      const [row] = await db
        .select({ repostCount: postTable.repostCount })
        .from(postTable)
        .where(eq(postTable.id, "p1"));
      return row.repostCount;
    }

    async function commentLikeCount() {
      const [row] = await db
        .select({ likeCount: postCommentTable.likeCount })
        .from(postCommentTable)
        .where(eq(postCommentTable.id, "c1"));
      return row.likeCount;
    }

    async function seedComment(authorId: string) {
      await db
        .insert(postCommentTable)
        .values({ id: "c1", postId: "p1", authorId, content: "hi" });
    }

    it("addRepostAction bumps repostCount and awards repost aura", async () => {
      const app = buildApp(db, authed("viewer", { createdAt: OLD }));
      const { json } = await callJson<{ success: true; repost: unknown }>(
        app,
        "addRepostAction",
        { postId: "p1" },
      );

      expect(json).toMatchObject({
        success: true,
        repost: { postId: "p1", userId: "viewer" },
      });
      expect(await repostCount()).toBe(1);
      expect(await points(db, "author")).toBe(3);
    });

    it("a duplicate repost is a no-op", async () => {
      const app = buildApp(db, authed("viewer", { createdAt: OLD }));
      await callJson(app, "addRepostAction", { postId: "p1" });
      const { json } = await callJson(app, "addRepostAction", {
        postId: "p1",
      });

      expect(json).toEqual({ success: true, alreadyReposted: true });
      expect(await repostCount()).toBe(1);
      expect(await points(db, "author")).toBe(3);
    });

    it("a self repost counts but awards nothing", async () => {
      const app = buildApp(db, authed("author", { createdAt: OLD }));
      await callJson(app, "addRepostAction", { postId: "p1" });

      expect(await repostCount()).toBe(1);
      expect(await points(db, "author")).toBe(0);
    });

    it("removeRepostAction reverses the count and aura", async () => {
      const app = buildApp(db, authed("viewer", { createdAt: OLD }));
      await callJson(app, "addRepostAction", { postId: "p1" });
      const { json } = await callJson(app, "removeRepostAction", {
        postId: "p1",
      });

      expect(json).toEqual({ success: true });
      expect(await repostCount()).toBe(0);
      expect(await points(db, "author")).toBe(0);
      expect(await db.select().from(postRepostTable)).toHaveLength(0);
    });

    it("removing a repost that never existed leaves the count alone", async () => {
      await db
        .update(postTable)
        .set({ repostCount: 5 })
        .where(eq(postTable.id, "p1"));
      await db
        .update(userTable)
        .set({ points: 10 })
        .where(eq(userTable.id, "author"));
      const app = buildApp(db, authed("viewer", { createdAt: OLD }));
      const { json } = await callJson(app, "removeRepostAction", {
        postId: "p1",
      });

      expect(json).toEqual({ success: true, alreadyRemoved: true });
      expect(await repostCount()).toBe(5);
      expect(await points(db, "author")).toBe(10);
    });

    it("addCommentLikeAction awards the COMMENT author, not the post author", async () => {
      await seedUser(db, "commenter");
      await seedComment("commenter");
      const app = buildApp(db, authed("viewer", { createdAt: OLD }));
      const { json } = await callJson(app, "addCommentLikeAction", {
        commentId: "c1",
      });

      expect(json).toEqual({ success: true });
      expect(await commentLikeCount()).toBe(1);
      expect(await points(db, "commenter")).toBe(1);
      expect(await points(db, "author")).toBe(0);
    });

    it("a self comment-like counts but awards nothing", async () => {
      await seedUser(db, "commenter");
      await seedComment("commenter");
      const app = buildApp(db, authed("commenter", { createdAt: OLD }));
      await callJson(app, "addCommentLikeAction", { commentId: "c1" });

      expect(await commentLikeCount()).toBe(1);
      expect(await points(db, "commenter")).toBe(0);
    });

    it("removeCommentLikeAction reverses the count and aura", async () => {
      await seedUser(db, "commenter");
      await seedComment("commenter");
      const app = buildApp(db, authed("viewer", { createdAt: OLD }));
      await callJson(app, "addCommentLikeAction", { commentId: "c1" });
      const { json } = await callJson(app, "removeCommentLikeAction", {
        commentId: "c1",
      });

      expect(json).toEqual({ success: true });
      expect(await commentLikeCount()).toBe(0);
      expect(await points(db, "commenter")).toBe(0);
      expect(await db.select().from(postCommentLikeTable)).toHaveLength(0);
    });

    it("unliking a comment the viewer never liked leaves the count alone", async () => {
      await seedUser(db, "commenter");
      await seedComment("commenter");
      await db
        .update(postCommentTable)
        .set({ likeCount: 3 })
        .where(eq(postCommentTable.id, "c1"));
      await db
        .update(userTable)
        .set({ points: 10 })
        .where(eq(userTable.id, "commenter"));
      const app = buildApp(db, authed("viewer", { createdAt: OLD }));
      const { json } = await callJson(app, "removeCommentLikeAction", {
        commentId: "c1",
      });

      expect(json).toEqual({ success: true, alreadyRemoved: true });
      expect(await commentLikeCount()).toBe(3);
      expect(await points(db, "commenter")).toBe(10);
    });
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

  describe("note actions", () => {
    async function noteRows(userId: string) {
      return db.select().from(noteTable).where(eq(noteTable.userId, userId));
    }

    it("clearNoteAction removes the note row instead of blanking it", async () => {
      const app = buildApp(db, authed("author", { createdAt: OLD }));
      await callJson(app, "createNoteAction", { content: "hello" });
      const [note] = await noteRows("author");
      await db
        .insert(noteReactionTable)
        .values({ noteId: note.id, userId: "viewer" });

      const { json } = await callJson(app, "clearNoteAction");

      expect(json).toEqual({ success: true });
      expect(await noteRows("author")).toHaveLength(0);
      expect(await db.select().from(noteReactionTable)).toHaveLength(0);
    });

    it("a note can be written again after clearing", async () => {
      const app = buildApp(db, authed("author", { createdAt: OLD }));
      await callJson(app, "createNoteAction", { content: "hello" });
      await callJson(app, "clearNoteAction");
      await callJson(app, "createNoteAction", { content: "again" });

      const rows = await noteRows("author");
      expect(rows).toHaveLength(1);
      expect(rows[0].content).toBe("again");
    });

    it("clearNoteAction removes disputes on the cleared note", async () => {
      const app = buildApp(db, authed("author", { createdAt: OLD }));
      await callJson(app, "createNoteAction", { content: "hello" });
      const [note] = await noteRows("author");
      await db.insert(moderationDisputeTable).values({
        kind: "note",
        targetId: note.id,
        userId: "viewer",
      });

      await callJson(app, "clearNoteAction");

      expect(await db.select().from(moderationDisputeTable)).toHaveLength(0);
    });
  });

  it("commenting on a post deleted mid-request returns not found", async () => {
    // The classifier await is the window between the existence read and the
    // insert; delete the post inside it.
    classifyContent.mockImplementationOnce(async () => {
      await db.delete(postTable).where(eq(postTable.id, "p1"));
      return null;
    });
    const app = buildApp(db, authed("viewer", { createdAt: OLD }));

    const { json } = await callJson(app, "createCommentAction", {
      postId: "p1",
      content: "too late",
    });

    expect(json).toEqual({ error: "Post not found" });
    expect(await db.select().from(postCommentTable)).toHaveLength(0);
  });
});
