import { beforeEach, describe, expect, it, vi } from "vitest";

const { classifyContentWithOutcome } = vi.hoisted(() => ({
  classifyContentWithOutcome: vi.fn(),
}));
vi.mock("../src/server-lib/content-classifier", () => ({
  classifyContentWithOutcome,
}));

import { noteTable } from "@umamin/db/schema/note";
import {
  pollOptionTable,
  postCommentTable,
  postTable,
} from "@umamin/db/schema/post";
import { userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import { retryUnclassifiedContent } from "../src/server-lib/content-retry";
import type { Db } from "../src/server-lib/db";
import type { AppEnv } from "../src/server-lib/env";
import { makeTestDb } from "./helpers/db";

const env = { AI_GATEWAY_API_KEY: "test-key" } as AppEnv;
const SCORES = { severe: 91, drama: 40, reason: "harassment" };
const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60 * 1000);

describe("retryUnclassifiedContent (real libSQL)", () => {
  let db: Db;

  beforeEach(async () => {
    classifyContentWithOutcome.mockReset();
    classifyContentWithOutcome.mockResolvedValue({
      scores: SCORES,
      failure: null,
    });
    db = await makeTestDb();
    await db.insert(userTable).values([
      { id: "a", username: "u_a" },
      { id: "b", username: "u_b" },
      { id: "c", username: "u_c" },
    ]);
  });

  it("re-classifies only recent unclassified rows, with their write-time context", async () => {
    await db.insert(postTable).values([
      {
        id: "quoted",
        content: "the quoted post",
        authorId: "b",
        modSevere: 1,
        createdAt: minutesAgo(600),
      },
      {
        id: "missed",
        content: "quote reply",
        authorId: "a",
        quotedPostId: "quoted",
        createdAt: minutesAgo(30),
      },
      {
        id: "poll",
        content: "sino pinaka pangit?",
        authorId: "a",
        pollEndsAt: minutesAgo(-60),
        createdAt: minutesAgo(20),
      },
      {
        id: "scored",
        content: "already done",
        authorId: "a",
        modSevere: 2,
        createdAt: minutesAgo(20),
      },
      {
        id: "stale",
        content: "too old to retry",
        authorId: "a",
        createdAt: minutesAgo(7 * 60),
      },
      {
        id: "fresh",
        content: "just written",
        authorId: "a",
        createdAt: minutesAgo(0.2),
      },
    ]);
    await db.insert(pollOptionTable).values([
      { postId: "poll", idx: 1, label: "@mae" },
      { postId: "poll", idx: 0, label: "@jessa" },
    ]);
    await db.insert(postCommentTable).values([
      {
        id: "c-old",
        postId: "quoted",
        authorId: "b",
        content: "si @x yan",
        modSevere: 3,
        createdAt: minutesAgo(50),
      },
      {
        id: "c-own",
        postId: "quoted",
        authorId: "c",
        content: "my earlier one",
        modSevere: 3,
        createdAt: minutesAgo(45),
      },
      {
        id: "c-missed",
        postId: "quoted",
        authorId: "c",
        content: "HAHA tama",
        createdAt: minutesAgo(40),
      },
      {
        id: "c-later",
        postId: "quoted",
        authorId: "a",
        content: "written after",
        modSevere: 3,
        createdAt: minutesAgo(10),
      },
    ]);
    await db.insert(noteTable).values([
      {
        id: "n-missed",
        userId: "a",
        content: "a note",
        isAnonymous: false,
        updatedAt: minutesAgo(15),
      },
      {
        id: "n-empty",
        userId: "b",
        content: "",
        isAnonymous: false,
        updatedAt: minutesAgo(15),
      },
    ]);

    const result = await retryUnclassifiedContent(db, env);

    const inputs = classifyContentWithOutcome.mock.calls.map(
      ([, input]) => input,
    );
    expect(inputs).toHaveLength(4);
    expect(inputs).toEqual(
      expect.arrayContaining([
        { kind: "post", text: "quote reply", context: "the quoted post" },
        {
          kind: "post",
          text: "sino pinaka pangit?\nPoll options: @jessa, @mae",
          context: null,
        },
        {
          kind: "comment",
          text: "HAHA tama",
          context: "the quoted post",
          thread: ["si @x yan"],
        },
        { kind: "note", text: "a note" },
      ]),
    );
    // Only "fresh" (inside the minimum age) is still unclassified.
    expect(result).toEqual({ attempted: 4, classified: 4, backlog: 1 });

    const severe = async (table: typeof postTable, id: string) =>
      (await db.select().from(table).where(eq(table.id, id)))[0];
    expect(await severe(postTable, "missed")).toMatchObject({
      modSevere: 91,
      modReason: "harassment",
    });
    expect((await severe(postTable, "missed"))?.modFlaggedAt).toBeInstanceOf(
      Date,
    );
    expect((await severe(postTable, "stale"))?.modSevere).toBeNull();
    expect((await severe(postTable, "fresh"))?.modSevere).toBeNull();
    const [comment] = await db
      .select()
      .from(postCommentTable)
      .where(eq(postCommentTable.id, "c-missed"));
    expect(comment?.modSevere).toBe(91);
  });

  it("drops the scores when a note is rewritten while it is being classified", async () => {
    const savedAt = minutesAgo(15);
    await db.insert(noteTable).values({
      id: "n1",
      userId: "a",
      content: "old text",
      isAnonymous: false,
      updatedAt: savedAt,
    });
    classifyContentWithOutcome.mockImplementation(async () => {
      await db
        .update(noteTable)
        .set({ content: "new text", updatedAt: new Date() })
        .where(eq(noteTable.id, "n1"));
      return { scores: SCORES, failure: null };
    });

    const result = await retryUnclassifiedContent(db, env);

    expect(result).toMatchObject({ attempted: 1, classified: 0 });
    const [row] = await db.select().from(noteTable);
    expect(row).toMatchObject({ content: "new text", modSevere: null });
  });

  it("keeps a note's feed position when it does write the scores", async () => {
    const savedAt = new Date(
      Math.floor(minutesAgo(15).getTime() / 1000) * 1000,
    );
    await db.insert(noteTable).values({
      id: "n1",
      userId: "a",
      content: "a note",
      isAnonymous: false,
      updatedAt: savedAt,
    });

    await retryUnclassifiedContent(db, env);

    const [row] = await db.select().from(noteTable);
    expect(row?.modSevere).toBe(91);
    expect(row?.updatedAt).toEqual(savedAt);
  });

  it("sends nothing without a Gateway key", async () => {
    await db.insert(postTable).values({
      id: "p1",
      content: "missed",
      authorId: "a",
      createdAt: minutesAgo(10),
    });
    await retryUnclassifiedContent(db, {} as AppEnv);
    expect(classifyContentWithOutcome).not.toHaveBeenCalled();
  });

  // Oldest first, so rows near the window's edge are tried before they age out.
  it("retries the oldest rows first", async () => {
    await db.insert(postTable).values(
      Array.from({ length: 12 }, (_, i) => ({
        id: `p${i + 1}`,
        content: `missed ${i + 1}`,
        authorId: "a",
        createdAt: minutesAgo((i + 1) * 10),
      })),
    );

    await retryUnclassifiedContent(db, env);

    const texts = classifyContentWithOutcome.mock.calls
      .map(([, input]) => input.text as string)
      .sort();
    // p1 and p2 are the two newest (10 and 20 minutes ago); the rest are tried.
    expect(texts).toHaveLength(10);
    expect(texts).not.toContain("missed 1");
    expect(texts).not.toContain("missed 2");
    expect(texts).toContain("missed 12");
  });

  it("finds an unclassified comment older than the newest 200 comments", async () => {
    await db
      .insert(postTable)
      .values({ id: "p", content: "parent", authorId: "b", modSevere: 1 });
    await db.insert(postCommentTable).values({
      id: "missed",
      postId: "p",
      authorId: "a",
      content: "slipped through",
      createdAt: minutesAgo(30),
    });
    await db.insert(postCommentTable).values(
      Array.from({ length: 210 }, (_, i) => ({
        id: `done${i}`,
        postId: "p",
        authorId: "c",
        content: `later ${i}`,
        modSevere: 1,
        createdAt: minutesAgo(20),
      })),
    );

    await retryUnclassifiedContent(db, env);

    const [row] = await db
      .select()
      .from(postCommentTable)
      .where(eq(postCommentTable.id, "missed"));
    expect(row?.modSevere).toBe(91);
  });

  describe("permanent failures", () => {
    const store = new Map<string, string>();
    const kv = {
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      put: vi.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
    };
    const kvEnv = {
      AI_GATEWAY_API_KEY: "test-key",
      KV: kv,
    } as unknown as AppEnv;

    beforeEach(async () => {
      store.clear();
      kv.get.mockClear();
      kv.put.mockClear();
      await db.insert(postTable).values({
        id: "bad",
        content: "the gateway refuses this",
        authorId: "a",
        createdAt: minutesAgo(10),
      });
    });

    it("stops after three permanent failures and reports only the first", async () => {
      classifyContentWithOutcome.mockResolvedValue({
        scores: null,
        failure: "permanent",
      });

      for (let run = 0; run < 4; run++) {
        await retryUnclassifiedContent(db, kvEnv);
      }

      expect(classifyContentWithOutcome).toHaveBeenCalledTimes(3);
      const reports = classifyContentWithOutcome.mock.calls.map(
        ([, , opts]) => opts.report,
      );
      expect(reports).toEqual([true, false, false]);
      expect(store.get("clsretry:post:bad")).toBe("3");
    });

    it("doesn't count transient failures", async () => {
      classifyContentWithOutcome.mockResolvedValue({
        scores: null,
        failure: "transient",
      });

      for (let run = 0; run < 4; run++) {
        await retryUnclassifiedContent(db, kvEnv);
      }

      expect(classifyContentWithOutcome).toHaveBeenCalledTimes(4);
      expect(kv.put).not.toHaveBeenCalled();
    });

    it("keeps retrying when KV fails", async () => {
      classifyContentWithOutcome.mockResolvedValue({
        scores: null,
        failure: "permanent",
      });
      kv.get.mockRejectedValueOnce(new Error("kv down"));
      kv.put.mockRejectedValueOnce(new Error("kv down"));

      await expect(retryUnclassifiedContent(db, kvEnv)).resolves.toMatchObject({
        attempted: 1,
      });
    });
  });

  it("returns the unclassified backlog", async () => {
    classifyContentWithOutcome.mockResolvedValue({
      scores: null,
      failure: "transient",
    });
    await db.insert(postTable).values({
      id: "p1",
      content: "missed",
      authorId: "a",
      createdAt: minutesAgo(10),
    });
    await db.insert(noteTable).values({
      id: "n1",
      userId: "a",
      content: "a note",
      isAnonymous: false,
      updatedAt: minutesAgo(10),
    });

    const result = await retryUnclassifiedContent(db, env);

    expect(result).toEqual({ attempted: 2, classified: 0, backlog: 2 });
  });
});
