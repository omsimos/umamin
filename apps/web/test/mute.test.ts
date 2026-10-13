import { beforeEach, describe, expect, it, vi } from "vitest";

// actionsApp pulls argon2's workers-only .wasm in transitively; nothing here
// hashes a password.
vi.mock("../src/server-lib/argon2", () => ({
  hash: async () => "",
  verify: async () => false,
}));

vi.mock("../src/server-lib/posthog", () => ({
  captureRequestException: vi.fn(),
  captureServerException: vi.fn(),
}));

import { noteTable } from "@umamin/db/schema/note";
import { notificationTable } from "@umamin/db/schema/notification";
import {
  postCommentTable,
  postRepostTable,
  postTable,
} from "@umamin/db/schema/post";
import { userMuteTable, userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import {
  getMutedUsersPage,
  getNotesPage,
  getPostCommentsPage,
  getPostsPage,
  getUserProfileViewerData,
} from "../src/server-lib/data";
import type { Db } from "../src/server-lib/db";
import type { AppEnv } from "../src/server-lib/env";
import { MAX_MUTES } from "../src/server-lib/mutes";
import { notify } from "../src/server-lib/notifications";
import { authed, buildApp, callJson } from "./helpers/actions";
import { makeTestDb } from "./helpers/db";

async function mute(db: Db, muterId: string, mutedId: string) {
  await db.insert(userMuteTable).values({ muterId, mutedId });
}

async function latestPostIds(db: Db, viewerId: string | null) {
  const page = await getPostsPage(db, undefined, { sort: "latest", viewerId });
  return page.data.map((item) =>
    item.type === "repost" ? `repost:${item.post.id}` : item.post.id,
  );
}

describe("mute (real libSQL)", () => {
  let db: Db;

  beforeEach(async () => {
    db = await makeTestDb();
    await db.insert(userTable).values([
      { id: "viewer", username: "u_viewer" },
      { id: "loud", username: "u_loud" },
      { id: "calm", username: "u_calm" },
    ]);
  });

  describe("actions", () => {
    it("refuses to mute yourself", async () => {
      const app = buildApp(db, authed("viewer"));
      const { json } = await callJson(app, "muteUserAction", {
        userId: "viewer",
      });
      expect(json).toEqual({ error: "You cannot mute yourself." });
    });

    it("mutes once even when repeated, and unmute removes the row", async () => {
      const app = buildApp(db, authed("viewer"));
      await callJson(app, "muteUserAction", { userId: "loud" });
      await callJson(app, "muteUserAction", { userId: "loud" });
      expect(await db.select().from(userMuteTable)).toHaveLength(1);

      await callJson(app, "unmuteUserAction", { userId: "loud" });
      expect(await db.select().from(userMuteTable)).toHaveLength(0);
    });

    it("stops at the mute cap", async () => {
      const filler = Array.from({ length: MAX_MUTES }, (_, i) => ({
        id: `f${i}`,
        username: `u_f${i}`,
      }));
      await db.insert(userTable).values(filler);
      await db
        .insert(userMuteTable)
        .values(filler.map((u) => ({ muterId: "viewer", mutedId: u.id })));

      const app = buildApp(db, authed("viewer"));
      const { json } = await callJson<{ error?: string }>(
        app,
        "muteUserAction",
        { userId: "loud" },
      );
      expect(json.error).toMatch(/up to 1000/);
      expect(
        await db
          .select()
          .from(userMuteTable)
          .where(eq(userMuteTable.mutedId, "loud")),
      ).toHaveLength(0);
    });
  });

  describe("feed", () => {
    beforeEach(async () => {
      await db.insert(postTable).values([
        { id: "loud-post", content: "drama", authorId: "loud" },
        { id: "calm-post", content: "hello", authorId: "calm" },
        {
          id: "calm-quote",
          content: "look",
          authorId: "calm",
          quotedPostId: "loud-post",
        },
      ]);
      await db
        .insert(postRepostTable)
        .values({ id: "r1", postId: "calm-post", userId: "loud" });
      await mute(db, "viewer", "loud");
    });

    it("drops the muted author's posts and reposts for the muter", async () => {
      const ids = await latestPostIds(db, "viewer");
      expect(ids).not.toContain("loud-post");
      expect(ids).not.toContain("repost:calm-post");
      expect(ids).toContain("calm-post");
    });

    it("turns a quote of the muted author into the unavailable husk", async () => {
      const page = await getPostsPage(db, undefined, {
        sort: "latest",
        viewerId: "viewer",
      });
      const quote = page.data.find((item) => item.post.id === "calm-quote");
      expect(quote?.post.quotedPost).toBeNull();
    });

    it("is one-way and leaves logged-out viewers alone", async () => {
      await db
        .insert(postTable)
        .values({ id: "viewer-post", content: "hi", authorId: "viewer" });

      expect(await latestPostIds(db, "loud")).toContain("viewer-post");
      expect(await latestPostIds(db, null)).toContain("loud-post");
    });
  });

  it("marks muted comments instead of dropping them", async () => {
    await db
      .insert(postTable)
      .values({ id: "p1", content: "topic", authorId: "calm" });
    await db.insert(postCommentTable).values([
      { id: "c1", postId: "p1", authorId: "loud", content: "fight me" },
      { id: "c2", postId: "p1", authorId: "calm", content: "ok" },
    ]);
    await mute(db, "viewer", "loud");

    const page = await getPostCommentsPage(db, {
      postId: "p1",
      viewerId: "viewer",
    });
    const byId = new Map(page.data.map((c) => [c.id, c]));
    expect(byId.get("c1")?.isMuted).toBe(true);
    expect(byId.get("c2")?.isMuted).toBe(false);
  });

  it("hides the muted author's named note but not their anonymous one", async () => {
    await db.insert(userTable).values({ id: "anon", username: "u_anon" });
    await db.insert(noteTable).values([
      { id: "n1", userId: "loud", content: "named", isAnonymous: false },
      { id: "n2", userId: "calm", content: "fine", isAnonymous: false },
      { id: "n3", userId: "anon", content: "secret", isAnonymous: true },
    ]);
    await mute(db, "viewer", "loud");
    await mute(db, "viewer", "anon");

    const page = await getNotesPage(db, { viewerId: "viewer" });
    expect(page.data.map((n) => n.id).sort()).toEqual(["n2", "n3"]);
  });

  describe("notifications", () => {
    const env = {} as AppEnv;

    it("drops a notification from an account the recipient muted", async () => {
      await mute(db, "viewer", "loud");
      await notify(
        { db, env },
        { recipientId: "viewer", type: "like", targetId: "p", actorId: "loud" },
      );
      expect(
        await db
          .select()
          .from(notificationTable)
          .where(eq(notificationTable.recipientId, "viewer")),
      ).toHaveLength(0);
    });

    it("still notifies the muted user about the muter's activity", async () => {
      await mute(db, "viewer", "loud");
      await notify(
        { db, env },
        { recipientId: "loud", type: "like", targetId: "p", actorId: "viewer" },
      );
      expect(
        await db
          .select()
          .from(notificationTable)
          .where(eq(notificationTable.recipientId, "loud")),
      ).toHaveLength(1);
    });
  });

  it("reports mute state on the profile and lists muted accounts", async () => {
    await mute(db, "viewer", "loud");

    const viewer = await getUserProfileViewerData(db, "u_loud", "viewer");
    expect(viewer?.isMuted).toBe(true);
    const other = await getUserProfileViewerData(db, "u_calm", "viewer");
    expect(other?.isMuted).toBe(false);

    const list = await getMutedUsersPage(db, { viewerId: "viewer" });
    expect(list.data.map((u) => u.username)).toEqual(["u_loud"]);
  });
});
