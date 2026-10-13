import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/server-lib/argon2", () => ({
  hash: async () => "",
  verify: async () => false,
}));

vi.mock("../src/server-lib/posthog", () => ({
  captureRequestException: vi.fn(),
  captureServerException: vi.fn(),
}));

const { classifyContent } = vi.hoisted(() => ({ classifyContent: vi.fn() }));
vi.mock("../src/server-lib/content-classifier", () => ({ classifyContent }));

import { messageReplyTable, messageTable } from "@umamin/db/schema/message";
import { noteTable } from "@umamin/db/schema/note";
import { postCommentTable, postTable } from "@umamin/db/schema/post";
import { userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import {
  getMessagesPage,
  getMessageThread,
  getNotesPage,
  getPostById,
  getPostCommentsPage,
  getPostsPage,
  getUserPostsPage,
} from "../src/server-lib/data";
import type { Db } from "../src/server-lib/db";
import { recomputeHotFeed } from "../src/server-lib/feed-rank";
import {
  getDramaReviewPage,
  getSevereReviewPage,
} from "../src/server-lib/moderation-review";
import { ANON, authed, buildApp, callJson } from "./helpers/actions";
import { makeTestDb } from "./helpers/db";

const SEVERE = { modSevere: 95, modDrama: 99, modReason: "harassment" };
const DRAMA = { modSevere: 40, modDrama: 98, modReason: "indirect" };
const CLEAN = { modSevere: 2, modDrama: 3, modReason: null };

// Every raw classifier column is server-only; a leak would let users read
// their own scores and write just under the thresholds.
function expectNoRawScores(payload: unknown) {
  expect(JSON.stringify(payload)).not.toMatch(/"mod[A-Z]/);
}

describe("content moderation (real libSQL)", () => {
  let db: Db;

  beforeEach(async () => {
    classifyContent.mockReset();
    db = await makeTestDb();
    await db.insert(userTable).values([
      { id: "author", username: "u_author" },
      { id: "viewer", username: "u_viewer" },
    ]);
  });

  describe("read payloads", () => {
    beforeEach(async () => {
      const t = Date.now() / 1000;
      await db.insert(postTable).values([
        {
          id: "severe",
          content: "s",
          authorId: "author",
          createdAt: new Date((t - 30) * 1000),
          ...SEVERE,
        },
        {
          id: "drama",
          content: "d",
          authorId: "author",
          createdAt: new Date((t - 20) * 1000),
          ...DRAMA,
        },
        {
          id: "clean",
          content: "c",
          authorId: "author",
          createdAt: new Date((t - 10) * 1000),
          quotedPostId: "severe",
          ...CLEAN,
        },
      ]);
    });

    it("labels posts and quotes when enforced, and never ships raw scores", async () => {
      const page = await getPostsPage(db, undefined, {
        sort: "latest",
        enforce: true,
      });
      const byId = new Map(page.data.map((item) => [item.post.id, item.post]));
      expect(byId.get("severe")?.moderation).toBe("severe");
      expect(byId.get("drama")?.moderation).toBe("drama");
      expect(byId.get("clean")?.moderation).toBeNull();
      expect(byId.get("clean")?.quotedPost?.moderation).toBe("severe");
      expectNoRawScores(page);
    });

    it("shows nothing in shadow mode", async () => {
      const page = await getPostsPage(db, undefined, {
        sort: "latest",
        enforce: false,
      });
      expect(page.data.every((item) => item.post.moderation === null)).toBe(
        true,
      );
      expectNoRawScores(page);
    });

    it("labels the single-post and profile reads too", async () => {
      const post = await getPostById(db, { postId: "severe", enforce: true });
      expect(post?.moderation).toBe("severe");
      expectNoRawScores(post);

      const profile = await getUserPostsPage(db, {
        authorId: "author",
        enforce: true,
      });
      expect(
        profile.data.find((item) => item.post.id === "drama")?.post.moderation,
      ).toBe("drama");
      expectNoRawScores(profile);
    });

    it("drops a cleared flag", async () => {
      await db
        .update(postTable)
        .set({ modClearedAt: new Date() })
        .where(eq(postTable.id, "severe"));
      const post = await getPostById(db, { postId: "severe", enforce: true });
      expect(post?.moderation).toBeNull();
    });

    it("labels comments and notes", async () => {
      await db.insert(postCommentTable).values({
        id: "c1",
        postId: "clean",
        authorId: "author",
        content: "x",
        ...DRAMA,
      });
      await db.insert(noteTable).values({
        id: "n1",
        userId: "author",
        content: "y",
        isAnonymous: false,
        ...SEVERE,
      });

      const comments = await getPostCommentsPage(db, {
        postId: "clean",
        enforce: true,
      });
      expect(comments.data[0]?.moderation).toBe("drama");
      expectNoRawScores(comments);

      const notes = await getNotesPage(db, { enforce: true });
      expect(notes.data[0]?.moderation).toBe("severe");
      expectNoRawScores(notes);
    });
  });

  describe("hot ranking", () => {
    beforeEach(async () => {
      const now = Date.now();
      await db.insert(postTable).values([
        // Old but hugely engaged: would top Hot on engagement alone.
        {
          id: "fight",
          content: "f",
          authorId: "author",
          createdAt: new Date(now - 3 * 3_600_000),
          commentCount: 400,
          repostCount: 200,
          ...DRAMA,
        },
        {
          id: "fresh",
          content: "h",
          authorId: "author",
          createdAt: new Date(now - 60_000),
          ...CLEAN,
        },
        {
          id: "abuse",
          content: "a",
          authorId: "author",
          createdAt: new Date(now - 30_000),
          likeCount: 50,
          ...SEVERE,
        },
      ]);
    });

    it("drops severe posts and the drama boost when enforced", async () => {
      const enforced = await getPostsPage(db, undefined, {
        sort: "hot",
        enforce: true,
      });
      expect(enforced.data.map((item) => item.post.id)).toEqual([
        "fresh",
        "fight",
      ]);

      const shadow = await getPostsPage(db, undefined, {
        sort: "hot",
        enforce: false,
      });
      expect(shadow.data[0]?.post.id).toBe("fight");
      expect(shadow.data.map((item) => item.post.id)).toContain("abuse");
    });

    it("applies the same rules in the cron's ranked list", async () => {
      const store = new Map<string, string>();
      const kv = {
        put: async (key: string, value: string) => void store.set(key, value),
      } as unknown as KVNamespace;

      await recomputeHotFeed(db, kv, true);
      expect(JSON.parse([...store.values()][0] ?? "[]")).toEqual([
        "fresh",
        "fight",
      ]);
    });
  });

  describe("write paths", () => {
    it("stores scores on a new post and returns the post without them", async () => {
      classifyContent.mockResolvedValue({
        severe: 90,
        drama: 99,
        reason: "harassment",
      });
      const app = buildApp(db, authed("author"));
      const { json } = await callJson<{ post: Record<string, unknown> }>(
        app,
        "createPostAction",
        { content: "you know who you are" },
      );
      expectNoRawScores(json);

      const [row] = await db
        .select()
        .from(postTable)
        .where(eq(postTable.id, json.post.id as string));
      expect(row).toMatchObject({ modSevere: 90, modReason: "harassment" });
      expect(row?.modFlaggedAt).toBeInstanceOf(Date);
    });

    it("stores nothing (and still posts) when classification fails", async () => {
      classifyContent.mockResolvedValue(null);
      const app = buildApp(db, authed("author"));
      const { json } = await callJson<{ success?: boolean }>(
        app,
        "createPostAction",
        { content: "hello" },
      );
      expect(json.success).toBe(true);
      const [row] = await db.select().from(postTable);
      expect(row).toMatchObject({ modSevere: null, modFlaggedAt: null });
    });

    it("passes the parent post to the classifier for a comment", async () => {
      await db
        .insert(postTable)
        .values({ id: "p1", content: "my exam results", authorId: "viewer" });
      classifyContent.mockResolvedValue({ severe: 1, drama: 1, reason: null });

      const app = buildApp(db, authed("author"));
      await callJson(app, "createCommentAction", {
        postId: "p1",
        content: "congrats!",
      });
      expect(classifyContent).toHaveBeenCalledWith(
        expect.anything(),
        { kind: "comment", text: "congrats!", context: "my exam results" },
        expect.anything(),
      );
    });

    it("replaces a note's scores and any moderator clear when it is rewritten", async () => {
      const app = buildApp(db, authed("author"));
      classifyContent.mockResolvedValue({
        severe: 92,
        drama: 10,
        reason: "threat",
      });
      await callJson(app, "createNoteAction", {
        content: "first",
        isAnonymous: false,
      });
      await db.update(noteTable).set({ modClearedAt: new Date() });

      classifyContent.mockResolvedValue({ severe: 1, drama: 2, reason: null });
      await callJson(app, "createNoteAction", {
        content: "second",
        isAnonymous: false,
      });

      const [row] = await db.select().from(noteTable);
      expect(row).toMatchObject({
        content: "second",
        modSevere: 1,
        modReason: null,
        modFlaggedAt: null,
        modClearedAt: null,
      });
    });
  });

  describe("review queue", () => {
    beforeEach(async () => {
      await db.insert(userTable).values({ id: "anon", username: "u_anon" });
      await db.insert(postTable).values([
        {
          id: "flagged",
          content: "f",
          authorId: "author",
          modFlaggedAt: new Date(Date.now() - 1000),
          ...SEVERE,
        },
        { id: "fine", content: "ok", authorId: "author", ...CLEAN },
      ]);
      await db.insert(noteTable).values({
        id: "anon-note",
        userId: "anon",
        content: "n",
        isAnonymous: true,
        modFlaggedAt: new Date(),
        ...SEVERE,
      });
    });

    it("lists flagged content newest first and hides anonymous authors", async () => {
      const page = await getSevereReviewPage(db, null);
      expect(page.data.map((item) => item.id)).toEqual([
        "anon-note",
        "flagged",
      ]);
      expect(page.data[0]?.author).toBeNull();
      expect(page.data[1]?.author?.username).toBe("u_author");
    });

    it("lets only a moderator clear a flag, which removes it from the queue", async () => {
      const outsider = buildApp(db, authed("viewer"));
      expect(
        (
          await callJson(
            outsider,
            "clearContentFlagAction",
            { kind: "post", id: "flagged" },
            { MODERATOR_USERS: "u_author" },
          )
        ).json,
      ).toEqual({ error: "Not found" });

      const moderator = buildApp(
        db,
        authed("author", { username: "u_author" }),
      );
      await callJson(
        moderator,
        "clearContentFlagAction",
        { kind: "post", id: "flagged" },
        { MODERATOR_USERS: "u_author" },
      );
      const page = await getSevereReviewPage(db, null);
      expect(page.data.map((item) => item.id)).toEqual(["anon-note"]);
    });

    it("surfaces recent drama scores for threshold checks", async () => {
      await db.insert(postTable).values({
        id: "parinig",
        content: "alam mo na kung sino ka",
        authorId: "author",
        ...DRAMA,
      });
      const page = await getDramaReviewPage(db);
      expect(page.data.map((item) => item.id)).toContain("parinig");
      expect(page.data.map((item) => item.id)).not.toContain("fine");
    });
  });

  describe("opt-in message filter", () => {
    const HURTFUL = { severe: 93, drama: 99, reason: "harassment" };

    beforeEach(async () => {
      // aesEncrypt reads the key from process.env (32 zero bytes here).
      process.env.AES_256_GCM_KEY = Buffer.from(new Uint8Array(32)).toString(
        "base64",
      );
      classifyContent.mockResolvedValue(HURTFUL);
    });

    const send = (content: string) =>
      callJson(buildApp(db, ANON), "sendMessageAction", {
        question: "ask me",
        content,
        receiverId: "viewer",
      });

    it("never sends a message to the classifier unless the receiver opted in", async () => {
      await send("you are the worst");
      expect(classifyContent).not.toHaveBeenCalled();
      const [row] = await db.select().from(messageTable);
      expect(row?.modSevere).toBeNull();
    });

    it("classifies and still delivers for a receiver who opted in", async () => {
      await db.update(userTable).set({ messageFilter: true });
      const { json } = await send("you are the worst");
      expect(json).toEqual({ success: true });
      expect(classifyContent).toHaveBeenCalledWith(
        expect.anything(),
        { kind: "message", text: "you are the worst" },
        expect.anything(),
      );
      const [row] = await db.select().from(messageTable);
      expect(row?.modSevere).toBe(93);
    });

    it("labels the receiver's copy only while their filter is on, and never the sender's", async () => {
      await db.update(userTable).set({ messageFilter: true });
      await callJson(buildApp(db, authed("author")), "sendMessageAction", {
        question: "ask me",
        content: "you are the worst",
        receiverId: "viewer",
      });

      const received = await getMessagesPage(db, {
        type: "received",
        userId: "viewer",
        filterMessages: true,
      });
      expect(received.messages[0]?.moderation).toBe("severe");
      expectNoRawScores(received);

      const filterOff = await getMessagesPage(db, {
        type: "received",
        userId: "viewer",
        filterMessages: false,
      });
      expect(filterOff.messages[0]?.moderation).toBeNull();

      const sent = await getMessagesPage(db, {
        type: "sent",
        userId: "author",
        filterMessages: true,
      });
      expect(sent.messages[0]?.moderation).toBeNull();
      expectNoRawScores(sent);
    });

    it("labels only the sender's follow-ups in the receiver's thread", async () => {
      await db.update(userTable).set({ messageFilter: true });
      await db.insert(messageTable).values({
        id: "m1",
        question: "q",
        content: "c",
        receiverId: "viewer",
        senderId: "author",
        reply: "first reply",
      });
      await db.insert(messageReplyTable).values([
        {
          id: "r1",
          messageId: "m1",
          fromSender: true,
          content: "x",
          modSevere: 95,
          modDrama: 10,
        },
        {
          id: "r2",
          messageId: "m1",
          fromSender: false,
          content: "y",
          modSevere: 95,
          modDrama: 10,
        },
      ]);

      const thread = await getMessageThread(db, {
        messageId: "m1",
        viewerId: "viewer",
        filterMessages: true,
      });
      const labels = new Map(thread?.replies.map((r) => [r.id, r.moderation]));
      expect(labels.get("r1")).toBe("severe");
      expect(labels.get("r2")).toBeNull();
      expectNoRawScores(thread);

      const senderView = await getMessageThread(db, {
        messageId: "m1",
        viewerId: "author",
        filterMessages: true,
      });
      expect(senderView?.replies.every((r) => r.moderation === null)).toBe(
        true,
      );
    });

    it("classifies a sender's follow-up only when the receiver opted in", async () => {
      await db.insert(messageTable).values({
        id: "m2",
        question: "q",
        content: "c",
        receiverId: "viewer",
        senderId: "author",
        reply: "receiver replied",
      });
      const followUp = () =>
        callJson(buildApp(db, authed("author")), "createReplyAction", {
          messageId: "m2",
          content: "you again",
        });

      await followUp();
      expect(classifyContent).not.toHaveBeenCalled();

      await db.update(userTable).set({ messageFilter: true });
      await followUp();
      expect(classifyContent).toHaveBeenCalledTimes(1);
      const rows = await db.select().from(messageReplyTable);
      expect(rows.map((r) => r.modSevere).sort()).toEqual([93, null]);
    });
  });
});
