import { postLikeTable, postTable } from "@umamin/db/schema/post";
import { userTable } from "@umamin/db/schema/user";
import { and, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/server-lib/db";
import { makeTestDb } from "./helpers/db";

// Characterization of SQLite's changes() ACROSS the statements of one
// db.batch, which is what lets the like/unlike handlers replace an interactive
// transaction (one HTTP round trip per await) with a single batched round trip:
// the JS-side `if (inserted.length === 0) return` branch becomes an SQL gate.
// A batch runs sequentially on ONE connection (local file client here, one
// Hrana stream in production), so changes() reads the previous statement's
// row count. Keep this suite as the guard for @libsql/client upgrades.

const GATE = sql`(SELECT changes()) > 0`;

async function seed(db: Db) {
  await db.insert(userTable).values([
    { id: "author", username: "u_author" },
    { id: "viewer", username: "u_viewer" },
  ]);
  await db
    .insert(postTable)
    .values({ id: "p1", content: "hello", authorId: "author" });
}

function likeInsert(db: Db, userId: string) {
  return db
    .insert(postLikeTable)
    .values({ postId: "p1", userId })
    .onConflictDoNothing()
    .returning({ id: postLikeTable.id });
}

function gatedBump(db: Db, postId = "p1") {
  return db
    .update(postTable)
    .set({ likeCount: sql`${postTable.likeCount} + 1` })
    .where(and(eq(postTable.id, postId), GATE))
    .returning({ authorId: postTable.authorId });
}

function gatedAward(db: Db) {
  return db
    .update(userTable)
    .set({ points: sql`${userTable.points} + 2` })
    .where(and(eq(userTable.id, "author"), GATE))
    .returning({ username: userTable.username });
}

async function counts(db: Db) {
  const [post] = await db
    .select({ likeCount: postTable.likeCount })
    .from(postTable)
    .where(eq(postTable.id, "p1"));
  const [author] = await db
    .select({ points: userTable.points })
    .from(userTable)
    .where(eq(userTable.id, "author"));
  return { likeCount: post.likeCount, points: author.points };
}

describe("changes() gating inside one db.batch", () => {
  let db: Db;

  beforeEach(async () => {
    db = await makeTestDb();
    await seed(db);
  });

  it("opens the gate for every downstream statement when the insert inserted", async () => {
    const [inserted, bumped, awarded] = await db.batch([
      likeInsert(db, "viewer"),
      gatedBump(db),
      gatedAward(db),
    ]);

    expect(inserted).toHaveLength(1);
    expect(bumped).toEqual([{ authorId: "author" }]);
    expect(awarded).toEqual([{ username: "u_author" }]);
    expect(await counts(db)).toEqual({ likeCount: 1, points: 2 });
  });

  it("closes the gate for every downstream statement when the insert conflicted", async () => {
    await db.batch([likeInsert(db, "viewer"), gatedBump(db), gatedAward(db)]);

    const [inserted, bumped, awarded] = await db.batch([
      likeInsert(db, "viewer"),
      gatedBump(db),
      gatedAward(db),
    ]);

    expect(inserted).toEqual([]);
    expect(bumped).toEqual([]);
    expect(awarded).toEqual([]);
    expect(await counts(db)).toEqual({ likeCount: 1, points: 2 });
  });

  // The chain only transitively encodes the insert because a statement that
  // matched NO rows reports changes() = 0 rather than leaving the previous
  // statement's count standing. Without this, a skipped bump would let the
  // award through on the insert's own count.
  it("an update that matched no rows closes the gate for the next statement", async () => {
    const [inserted, missed, awarded] = await db.batch([
      likeInsert(db, "viewer"),
      db
        .update(postTable)
        .set({ likeCount: sql`${postTable.likeCount} + 1` })
        .where(eq(postTable.id, "does-not-exist"))
        .returning({ authorId: postTable.authorId }),
      gatedAward(db),
    ]);

    expect(inserted).toHaveLength(1);
    expect(missed).toEqual([]);
    expect(awarded).toEqual([]);
    expect(await counts(db)).toEqual({ likeCount: 0, points: 0 });
  });

  it("delete-driven gating mirrors insert-driven gating", async () => {
    await db
      .insert(postLikeTable)
      .values({ postId: "p1", userId: "viewer" })
      .onConflictDoNothing();

    const removal = () =>
      db
        .delete(postLikeTable)
        .where(
          and(
            eq(postLikeTable.postId, "p1"),
            eq(postLikeTable.userId, "viewer"),
          ),
        )
        .returning({ id: postLikeTable.id });

    const [removed, bumped] = await db.batch([removal(), gatedBump(db)]);
    expect(removed).toHaveLength(1);
    expect(bumped).toEqual([{ authorId: "author" }]);

    const [reRemoved, notBumped] = await db.batch([removal(), gatedBump(db)]);
    expect(reRemoved).toEqual([]);
    expect(notBumped).toEqual([]);
  });
});
