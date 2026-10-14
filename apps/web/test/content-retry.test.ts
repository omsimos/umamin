import { beforeEach, describe, expect, it, vi } from "vitest";

const { classifyContent } = vi.hoisted(() => ({ classifyContent: vi.fn() }));
vi.mock("../src/server-lib/content-classifier", () => ({ classifyContent }));

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
    classifyContent.mockReset();
    classifyContent.mockResolvedValue(SCORES);
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

    const inputs = classifyContent.mock.calls.map(([, input]) => input);
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
    expect(result).toEqual({ attempted: 4, classified: 4 });

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
    classifyContent.mockImplementation(async () => {
      await db
        .update(noteTable)
        .set({ content: "new text", updatedAt: new Date() })
        .where(eq(noteTable.id, "n1"));
      return SCORES;
    });

    const result = await retryUnclassifiedContent(db, env);

    expect(result).toEqual({ attempted: 1, classified: 0 });
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
    expect(classifyContent).not.toHaveBeenCalled();
  });
});
