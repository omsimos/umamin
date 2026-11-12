import { beforeEach, describe, expect, it, vi } from "vitest";

// argon2's precompiled .wasm import only resolves in the workers pool; these
// node-pool suites pull argon2 in transitively via actionsApp but never call it.
vi.mock("../src/server-lib/argon2", () => ({
  hash: async () => "",
  verify: async () => false,
}));

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hotCounts, reconcileHotCount } from "@umamin/db/hot-counts";
import { pollOptionTable, postTable } from "@umamin/db/schema/post";
import { userTable } from "@umamin/db/schema/user";
import { eq, sql } from "drizzle-orm";
import type { Db } from "../src/server-lib/db";
import {
  __clearSessionCache,
  createSession,
  generateSessionToken,
} from "../src/server-lib/session";
import { authed, buildApp, callJson } from "./helpers/actions";
import { makeTestDb } from "./helpers/db";

const OLD = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

const BACKFILL = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/db/migrations/0033_hot_people_counts.sql",
);

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

// How many rows each reconcile statement would rewrite. All zero means the
// stored counts already equal the recomputed ones.
async function drift(db: Db) {
  const out: Record<string, number> = {};
  for (const [column, count] of Object.entries(hotCounts)) {
    const result = await db.run(reconcileHotCount(column, count));
    out[column] = result.rowsAffected;
  }
  return out;
}

const NO_DRIFT = {
  commenter_count: 0,
  liker_count: 0,
  voter_count: 0,
  resharer_count: 0,
};

function backfillStatements() {
  return readFileSync(BACKFILL, "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.startsWith("UPDATE `postTable` SET"));
}

describe("Hot people counts parity (real libSQL)", () => {
  let db: Db;

  beforeEach(async () => {
    __clearSessionCache();
    db = await makeTestDb();
    for (const id of ["author", "a", "b", "c"]) await seedUser(db, id);
    await seedPost(db, "p1", "author");
    await db
      .update(postTable)
      .set({ pollEndsAt: new Date(Date.now() + 60 * 60 * 1000) })
      .where(eq(postTable.id, "p1"));
    await db
      .insert(pollOptionTable)
      .values({ id: "o1", postId: "p1", idx: 0, label: "yes" });
  });

  const as = (userId: string) =>
    buildApp(db, authed(userId, { createdAt: OLD }));

  // A refused action would leave the counts trivially in step, so fail loudly.
  async function act<T = Record<string, unknown>>(
    userId: string,
    name: string,
    body: unknown,
  ) {
    const { json } = await callJson<T & { error?: string }>(
      as(userId),
      name,
      body,
    );
    if (json.error) throw new Error(`${name} as ${userId}: ${json.error}`);
    return json;
  }

  const comment = async (userId: string) => {
    const json = await act<{ comment?: { id: string } }>(
      userId,
      "createCommentAction",
      { postId: "p1", content: `from ${userId}` },
    );
    if (!json.comment) throw new Error("comment not created");
    return json.comment.id;
  };

  const quote = async (userId: string) => {
    const json = await act<{ post?: { id: string } }>(
      userId,
      "createPostAction",
      { content: "look", quotedPostId: "p1" },
    );
    if (!json.post) throw new Error("quote not created");
    return json.post.id;
  };

  // Labelled so a failure names the group of actions that drifted.
  async function expectNoDrift(step: string) {
    expect({ step, ...(await drift(db)) }).toEqual({ step, ...NO_DRIFT });
  }

  async function mixedHistory(check: (step: string) => Promise<void>) {
    for (const user of ["author", "a", "b"]) {
      await act(user, "addLikeAction", { postId: "p1" });
    }
    await act("b", "removeLikeAction", { postId: "p1" });
    // The author's own unlike takes the branch that must leave likers alone.
    await act("author", "removeLikeAction", { postId: "p1" });
    await act("author", "addLikeAction", { postId: "p1" });
    await check("likes");

    for (const user of ["author", "a"]) {
      await act(user, "votePollAction", { optionId: "o1" });
    }
    await check("votes");

    const aFirst = await comment("a");
    await comment("a");
    const bOnly = await comment("b");
    await act("a", "deleteCommentAction", { commentId: aFirst });
    await act("b", "deleteCommentAction", { commentId: bOnly });
    await check("comments");

    for (const user of ["author", "a"]) {
      await act(user, "addRepostAction", { postId: "p1" });
    }
    const aQuote = await quote("a");
    await quote("a");
    await quote("c");
    await act("a", "deletePostAction", { postId: aQuote });
    await act("a", "removeRepostAction", { postId: "p1" });
    await check("shares");
  }

  it("the live counters match the reconcile definitions after a mixed history", async () => {
    await mixedHistory(expectNoDrift);
    await expectNoDrift("end");
  });

  it("account deletion keeps them in step", async () => {
    await act("c", "addLikeAction", { postId: "p1" });
    await comment("c");
    await quote("c");
    await act("a", "addLikeAction", { postId: "p1" });
    await expectNoDrift("before delete");

    const token = generateSessionToken();
    await createSession(db, token, "c");
    const { json } = await callJson(
      as("c"),
      "deleteAccount",
      { confirmation: "delete my account" },
      {},
      { cookie: `session=${token}` },
    );
    expect(json).toEqual({ redirect: "/login" });
    await expectNoDrift("after delete");
  });

  it("the reconcile statements repair a wrong count", async () => {
    await db
      .update(postTable)
      .set({ likerCount: 99 })
      .where(eq(postTable.id, "p1"));

    expect(await drift(db)).toEqual({ ...NO_DRIFT, liker_count: 1 });
    expect(await drift(db)).toEqual(NO_DRIFT);
  });

  it("migration 0033's backfill matches the reconcile definitions", async () => {
    const statements = backfillStatements();
    expect(statements).toHaveLength(4);

    // No checks mid-history, so a failure here can only come from the backfill.
    await mixedHistory(async () => {});
    await db.update(postTable).set({
      commenterCount: 0,
      likerCount: 0,
      voterCount: 0,
      resharerCount: 0,
    });
    for (const statement of statements) await db.run(sql.raw(statement));

    await expectNoDrift("after backfill");
  });
});
