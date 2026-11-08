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

import type { Client, InStatement } from "@libsql/client";
import { messageReplyTable, messageTable } from "@umamin/db/schema/message";
import { noteTable } from "@umamin/db/schema/note";
import { notificationTable } from "@umamin/db/schema/notification";
import { postCommentTable, postTable } from "@umamin/db/schema/post";
import { userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { decisionAllowed } from "../src/api/actions/moderation";
import { IMAGE_AURA_REQUIRED_ERROR } from "../src/lib/post-images";
import {
  canTransition,
  isPendingReview,
  reviewState,
} from "../src/server-lib/content-label";
import {
  getCurrentNoteData,
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

// createR2 returns a client for well-formed credentials (it presigns locally,
// no network), which the image gate needs before it checks the author's aura.
const R2_ENV = {
  R2_ACCOUNT_ID: "a".repeat(32),
  R2_ACCESS_KEY_ID: "b".repeat(32),
  R2_SECRET_ACCESS_KEY: "c".repeat(64),
  R2_BUCKET: "umamin",
  R2_PUBLIC_URL: "https://cdn.example.com",
};

const SEVERE = { modSevere: 95, modDrama: 99, modReason: "harassment" };
const DRAMA = { modSevere: 40, modDrama: 98, modReason: "indirect" };
const CLEAN = { modSevere: 2, modDrama: 3, modReason: null };
const SCAM = { modSevere: 97, modDrama: 10, modReason: "scam" };

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

    it("labels a scam apart from other covered content", async () => {
      await db.insert(postTable).values({
        id: "scam",
        content: "free gcash https://example.test",
        authorId: "author",
        ...SCAM,
      });
      const post = await getPostById(db, { postId: "scam", enforce: true });
      expect(post?.moderation).toBe("scam");
      expectNoRawScores(post);
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

      // The author's own-note read carries the label so their card can say
      // how others see it, without the scores.
      const own = await getCurrentNoteData(db, "author", true);
      expect(own?.moderation).toBe("severe");
      expectNoRawScores(own);
      expect((await getCurrentNoteData(db, "author", false))?.moderation).toBe(
        null,
      );
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
        {
          id: "giveaway",
          content: "g",
          authorId: "author",
          createdAt: new Date(now - 20_000),
          commentCount: 300,
          ...SCAM,
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
      expect(shadow.data.map((item) => item.post.id)).toContain("giveaway");
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

    it("passes the parent post and other people's latest comments for a comment", async () => {
      await db.insert(userTable).values({ id: "third", username: "u_third" });
      await db
        .insert(postTable)
        .values({ id: "p1", content: "my exam results", authorId: "viewer" });
      const t = Date.now() / 1000;
      await db.insert(postCommentTable).values(
        [
          ["too old", "third"],
          ["si @x nangopya", "viewer"],
          ["my own earlier comment", "author"],
          ["true yan", "third"],
          ["kawawa naman", "viewer"],
        ].map(([content, authorId], i) => ({
          id: `c${i}`,
          postId: "p1",
          authorId,
          content,
          createdAt: new Date((t - 100 + i * 10) * 1000),
        })),
      );
      classifyContent.mockResolvedValue({ severe: 1, drama: 1, reason: null });

      const app = buildApp(db, authed("author"));
      await callJson(app, "createCommentAction", {
        postId: "p1",
        content: "HAHA tama",
      });
      expect(classifyContent).toHaveBeenCalledWith(
        expect.anything(),
        {
          kind: "comment",
          text: "HAHA tama",
          context: "my exam results",
          thread: ["si @x nangopya", "true yan", "kawawa naman"],
        },
        expect.objectContaining({ limitKey: "author" }),
      );
    });

    // One account's posts, comments and notes share a classifier budget, which
    // only works if every kind is keyed by the same user id.
    it("budgets a post's and a note's classifier calls per author", async () => {
      classifyContent.mockResolvedValue({ severe: 1, drama: 1, reason: null });
      const app = buildApp(db, authed("author"));
      await callJson(app, "createPostAction", { content: "hello world" });
      await callJson(app, "createNoteAction", {
        content: "a note",
        isAnonymous: false,
      });
      expect(classifyContent).toHaveBeenCalledTimes(2);
      for (const call of classifyContent.mock.calls) {
        expect(call[2]).toEqual(
          expect.objectContaining({ limitKey: "author" }),
        );
      }
    });

    it("doesn't classify a post its author may not attach images to", async () => {
      classifyContent.mockResolvedValue({ severe: 1, drama: 1, reason: null });
      const app = buildApp(db, authed("author", { points: 0 }));
      const { json } = await callJson<{ error?: string }>(
        app,
        "createPostAction",
        {
          content: "look",
          images: [{ key: "staging/author/a.webp", width: 10, height: 10 }],
        },
        R2_ENV,
      );
      expect(json.error).toBe(IMAGE_AURA_REQUIRED_ERROR);
      expect(classifyContent).not.toHaveBeenCalled();
    });

    it("classifies a poll's options with its question but stores only the question", async () => {
      classifyContent.mockResolvedValue({ severe: 1, drama: 1, reason: null });
      const app = buildApp(
        db,
        authed("author", { createdAt: new Date("2020-01-01") }),
      );
      const { json } = await callJson<{ success?: boolean }>(
        app,
        "createPostAction",
        {
          content: "sino pinaka pangit?",
          poll: { options: ["@jessa", "@mae"], duration: "1d" },
        },
      );
      expect(json.success).toBe(true);
      expect(classifyContent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          text: "sino pinaka pangit?\nPoll options: @jessa, @mae",
        }),
        expect.anything(),
      );
      const [row] = await db.select().from(postTable);
      expect(row?.content).toBe("sino pinaka pangit?");
    });

    it("keeps a folded comment's text out of the post author's notification", async () => {
      await db
        .insert(postTable)
        .values({ id: "p1", content: "my exam results", authorId: "viewer" });
      classifyContent.mockResolvedValue({
        severe: 20,
        drama: 95,
        reason: "callout",
      });

      await callJson(
        buildApp(db, authed("author")),
        "createCommentAction",
        { postId: "p1", content: "nangopya ka lang naman" },
        { FLAGS_FORCE_ON: "content-moderation" },
      );
      const [row] = await db.select().from(notificationTable);
      expect(row).toMatchObject({ type: "comment", preview: null });
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
      const page = await getSevereReviewPage(db, null, true);
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
            { kind: "post", id: "flagged", content: "f" },
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
        { kind: "post", id: "flagged", content: "f" },
        { MODERATOR_USERS: "u_author" },
      );
      const page = await getSevereReviewPage(db, null, true);
      expect(page.data.map((item) => item.id)).toEqual(["anon-note"]);
    });

    const MOD_ENV = {
      MODERATOR_USERS: "u_mod",
      FLAGS_FORCE_ON: "content-moderation",
    };
    const asUser = (id: string) =>
      buildApp(db, authed(id, { username: `u_${id}` }));
    const queueIds = async () =>
      (await getSevereReviewPage(db, null, true)).data.map((item) => item.id);

    it("shows what a flagged comment or quote responds to, and its live label", async () => {
      await db.insert(postTable).values({
        id: "quote",
        content: "grabe ito oh",
        authorId: "viewer",
        quotedPostId: "fine",
        modFlaggedAt: new Date(),
        ...SEVERE,
      });
      await db.insert(postCommentTable).values({
        id: "reply",
        postId: "fine",
        content: "tama",
        authorId: "viewer",
        modFlaggedAt: new Date(),
        modSevere: 65,
        modDrama: 10,
      });
      const page = await getSevereReviewPage(db, null, true);
      const byId = new Map(page.data.map((item) => [item.id, item]));
      expect(byId.get("quote")).toMatchObject({
        context: "ok",
        label: "severe",
      });
      // Flagged at 65 but under the cover line: in the queue, not covered.
      expect(byId.get("reply")).toMatchObject({ context: "ok", label: null });

      const shadow = await getSevereReviewPage(db, null, false);
      expect(shadow.data.every((item) => item.label === null)).toBe(true);
    });

    it("lets a moderator keep a label, which takes it out of the queue for good", async () => {
      await db.insert(userTable).values({ id: "mod", username: "u_mod" });
      expect(
        (
          await callJson(
            asUser("viewer"),
            "keepContentFlagAction",
            { kind: "post", id: "flagged", content: "f" },
            MOD_ENV,
          )
        ).json,
      ).toEqual({ error: "Not found" });

      await callJson(
        asUser("mod"),
        "keepContentFlagAction",
        { kind: "post", id: "flagged", content: "f" },
        MOD_ENV,
      );
      expect(await queueIds()).toEqual(["anon-note"]);
      const post = await getPostById(db, { postId: "flagged", enforce: true });
      expect(post?.moderation).toBe("severe");

      // Nobody can push it back in after the decision.
      expect(
        (
          await callJson(
            asUser("viewer"),
            "disputeContentLabelAction",
            { kind: "post", id: "flagged" },
            MOD_ENV,
          )
        ).json,
      ).toEqual({ error: "A moderator already reviewed this." });
      expect(await queueIds()).toEqual(["anon-note"]);
    });

    // updated_at is a note's position in the public /notes feed, and Drizzle's
    // $onUpdate restamps it on any update that doesn't set it.
    it("keeps a labelled note's feed position through every review action", async () => {
      await db.insert(userTable).values({ id: "mod", username: "u_mod" });
      const savedAt = new Date(
        Math.floor((Date.now() - 60 * 60 * 1000) / 1000) * 1000,
      );
      await db.insert(noteTable).values({
        id: "labelled",
        userId: "author",
        content: "mean words",
        isAnonymous: false,
        updatedAt: savedAt,
        ...SEVERE,
      });
      const updatedAt = async () =>
        (
          await db
            .select({ updatedAt: noteTable.updatedAt })
            .from(noteTable)
            .where(eq(noteTable.id, "labelled"))
        )[0]?.updatedAt;
      const act = async (action: string, user: string) => {
        const { json } = await callJson<{ success?: boolean }>(
          asUser(user),
          action,
          { kind: "note", id: "labelled", content: "mean words" },
          MOD_ENV,
        );
        expect(json.success).toBe(true);
        expect(await updatedAt()).toEqual(savedAt);
      };

      await act("disputeContentLabelAction", "viewer");
      await act("appealContentLabelAction", "author");
      await act("keepContentFlagAction", "mod");
      await act("clearContentFlagAction", "mod");
    });

    it("won't apply a decision made on a note's earlier text to its rewrite", async () => {
      await db.insert(userTable).values({ id: "mod", username: "u_mod" });
      const author = asUser("author");
      classifyContent.mockResolvedValue({
        severe: 92,
        drama: 10,
        reason: "threat",
      });
      await callJson(
        author,
        "createNoteAction",
        { content: "first", isAnonymous: false },
        MOD_ENV,
      );
      const seen = (await getSevereReviewPage(db, null, true)).data.find(
        (item) => item.content === "first",
      );
      expect(seen).toBeDefined();

      // Still flagged after the rewrite, so the stale row and the new one
      // differ only in their text.
      classifyContent.mockResolvedValue({
        severe: 95,
        drama: 10,
        reason: "threat",
      });
      await callJson(
        author,
        "createNoteAction",
        { content: "second", isAnonymous: false },
        MOD_ENV,
      );

      for (const action of [
        "clearContentFlagAction",
        "keepContentFlagAction",
      ]) {
        const { json } = await callJson(
          asUser("mod"),
          action,
          { kind: "note", id: seen?.id, content: seen?.content },
          MOD_ENV,
        );
        expect(json).toEqual({
          error: "This changed since you loaded it. Refresh to see the latest.",
        });
      }
      const [row] = await db
        .select()
        .from(noteTable)
        .where(eq(noteTable.userId, "author"));
      expect(row).toMatchObject({
        id: seen?.id,
        content: "second",
        modClearedAt: null,
        modReviewedAt: null,
      });
      expect(await queueIds()).toContain(seen?.id);
    });

    it("won't keep a label a moderator uncovered, but can uncover a kept one", async () => {
      await db.insert(userTable).values({ id: "mod", username: "u_mod" });
      await db.insert(postTable).values({
        id: "kept-first",
        content: "k",
        authorId: "author",
        modFlaggedAt: new Date(),
        ...SEVERE,
      });
      const decide = async (action: string, id: string, content: string) =>
        (
          await callJson(
            asUser("mod"),
            action,
            { kind: "post", id, content },
            MOD_ENV,
          )
        ).json;
      const label = async (postId: string) =>
        (await getPostById(db, { postId, enforce: true }))?.moderation;

      expect(await decide("clearContentFlagAction", "flagged", "f")).toEqual({
        success: true,
      });
      expect(await decide("keepContentFlagAction", "flagged", "f")).toEqual({
        error: "A moderator already reviewed this.",
      });
      const [cleared] = await db
        .select({ modReviewedAt: postTable.modReviewedAt })
        .from(postTable)
        .where(eq(postTable.id, "flagged"));
      expect(cleared?.modReviewedAt).toBeNull();
      expect(await label("flagged")).toBeNull();

      // The drama check offers Uncover on a kept label.
      expect(await decide("keepContentFlagAction", "kept-first", "k")).toEqual({
        success: true,
      });
      expect(await label("kept-first")).toBe("severe");
      expect(await decide("clearContentFlagAction", "kept-first", "k")).toEqual(
        { success: true },
      );
      expect(await label("kept-first")).toBeNull();
      expect(await queueIds()).toEqual(["anon-note"]);
    });

    it("won't record an appeal that lands after a moderator's decision", async () => {
      await db.insert(postTable).values({
        id: "sad",
        content: "i miss you",
        authorId: "author",
        ...DRAMA,
      });
      // A moderator keeps the label between the appeal's read and its write.
      const client = (db as unknown as { $client: Client }).$client;
      let raced = false;
      const racing = drizzle({
        client: new Proxy(client, {
          get(target, prop) {
            if (prop === "execute") {
              const execute = target.execute.bind(target) as (
                ...args: unknown[]
              ) => ReturnType<Client["execute"]>;
              return async (stmt: InStatement, ...rest: unknown[]) => {
                const text = typeof stmt === "string" ? stmt : stmt.sql;
                if (
                  !raced &&
                  text.startsWith("update") &&
                  text.includes("mod_appealed_at")
                ) {
                  raced = true;
                  await db
                    .update(postTable)
                    .set({ modReviewedAt: new Date() })
                    .where(eq(postTable.id, "sad"));
                }
                return execute(stmt, ...rest);
              };
            }
            const value = Reflect.get(target, prop);
            return typeof value === "function" ? value.bind(target) : value;
          },
        }),
      }) as unknown as Db;

      const { json } = await callJson(
        buildApp(racing, authed("author", { username: "u_author" })),
        "appealContentLabelAction",
        { kind: "post", id: "sad" },
        MOD_ENV,
      );
      expect(raced).toBe(true);
      expect(json).toEqual({ error: "A moderator already reviewed this." });
      const [row] = await db
        .select({ modAppealedAt: postTable.modAppealedAt })
        .from(postTable)
        .where(eq(postTable.id, "sad"));
      expect(row?.modAppealedAt).toBeNull();
    });

    it("queues exactly the rows reviewState calls pending", async () => {
      const at = new Date(Date.now() - 5000);
      const rows = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(
        (bits) => ({
          id: `combo-${bits}`,
          content: "c",
          authorId: "author",
          ...SEVERE,
          modFlaggedAt: bits & 1 ? at : null,
          modClearedAt: bits & 2 ? at : null,
          modReviewedAt: bits & 4 ? at : null,
          modAppealedAt: bits & 8 ? at : null,
        }),
      );
      await db.insert(postTable).values(rows);
      const queued = new Set(await queueIds());
      for (const row of rows) {
        expect([row.id, queued.has(row.id)]).toEqual([
          row.id,
          isPendingReview(reviewState(row)),
        ]);
      }
    });

    it("lets a decision write only the rows canTransition allows", async () => {
      const at = new Date(Date.now() - 5000);
      const scores = {
        severe: SEVERE,
        drama: DRAMA,
        clean: CLEAN,
        unscored: { modSevere: null, modDrama: null, modReason: null },
      };
      const rows = Object.entries(scores).flatMap(([name, score]) =>
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((bits) => ({
          id: `combo-${name}-${bits}`,
          content: "c",
          authorId: "author",
          ...score,
          modFlaggedAt: bits & 1 ? at : null,
          modClearedAt: bits & 2 ? at : null,
          modReviewedAt: bits & 4 ? at : null,
          modAppealedAt: bits & 8 ? at : null,
        })),
      );
      await db.insert(postTable).values(rows);

      for (const decision of ["clear", "keep"] as const) {
        const allowed = new Set(
          (
            await db
              .select({ id: postTable.id })
              .from(postTable)
              .where(decisionAllowed(postTable, decision))
          ).map((r) => r.id),
        );
        for (const row of rows) {
          expect([decision, row.id, allowed.has(row.id)]).toEqual([
            decision,
            row.id,
            canTransition(reviewState(row), decision),
          ]);
        }
      }
    });

    it("queues a folded post when its author asks for review, once", async () => {
      await db.insert(postTable).values({
        id: "sad",
        content: "i miss you",
        authorId: "author",
        ...DRAMA,
      });
      expect(await queueIds()).not.toContain("sad");

      expect(
        (
          await callJson(
            asUser("viewer"),
            "appealContentLabelAction",
            { kind: "post", id: "sad" },
            MOD_ENV,
          )
        ).json,
      ).toEqual({ error: "This isn't covered or folded anymore." });

      await callJson(
        asUser("author"),
        "appealContentLabelAction",
        { kind: "post", id: "sad" },
        MOD_ENV,
      );
      const item = (await getSevereReviewPage(db, null, true)).data.find(
        (entry) => entry.id === "sad",
      );
      expect(item).toMatchObject({ appealed: true, label: "drama" });

      // Nothing to appeal on unlabelled content.
      expect(
        (
          await callJson(
            asUser("author"),
            "appealContentLabelAction",
            { kind: "post", id: "fine" },
            MOD_ENV,
          )
        ).json,
      ).toEqual({ error: "This isn't covered or folded anymore." });
    });

    it("counts each viewer's dispute once and never the author's", async () => {
      await db.insert(userTable).values({ id: "other", username: "u_other" });
      await db.insert(postTable).values({
        id: "sad",
        content: "i miss you",
        authorId: "author",
        ...DRAMA,
      });
      const dispute = (id: string) =>
        callJson(
          asUser(id),
          "disputeContentLabelAction",
          { kind: "post", id: "sad" },
          MOD_ENV,
        );
      expect((await dispute("author")).json).toEqual({
        error: "This isn't covered or folded anymore.",
      });
      await dispute("viewer");
      await dispute("viewer");
      await dispute("other");

      const item = (await getSevereReviewPage(db, null, true)).data.find(
        (entry) => entry.id === "sad",
      );
      expect(item?.disputes).toBe(2);
    });

    it("surfaces recent drama scores for threshold checks", async () => {
      await db.insert(postTable).values({
        id: "parinig",
        content: "alam mo na kung sino ka",
        authorId: "author",
        ...DRAMA,
      });
      const page = await getDramaReviewPage(db, true);
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
      // A sender-supplied question ("ask me") never reaches the classifier;
      // the receiver's own profile prompt does.
      await db
        .update(userTable)
        .set({ messageFilter: true, question: "Roast me" });
      const { json } = await send("you are the worst");
      expect(json).toEqual({ success: true });
      expect(classifyContent).toHaveBeenCalledWith(
        expect.anything(),
        { kind: "message", text: "you are the worst", question: "Roast me" },
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

      await db
        .update(userTable)
        .set({ messageFilter: true, question: "q" })
        .where(eq(userTable.id, "viewer"));
      await followUp();
      expect(classifyContent).toHaveBeenCalledTimes(1);
      // The thread's question only; the receiver's reply stays out of it.
      expect(classifyContent).toHaveBeenCalledWith(
        expect.anything(),
        { kind: "message", text: "you again", question: "q" },
        expect.anything(),
      );
      const rows = await db.select().from(messageReplyTable);
      expect(rows.map((r) => r.modSevere).sort()).toEqual([93, null]);

      // A question the receiver didn't write (an old thread) is not context.
      await db
        .update(userTable)
        .set({ question: "something else" })
        .where(eq(userTable.id, "viewer"));
      await followUp();
      expect(classifyContent).toHaveBeenLastCalledWith(
        expect.anything(),
        { kind: "message", text: "you again", question: null },
        expect.anything(),
      );
    });
  });
});
