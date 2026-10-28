import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../src/server-lib/db";
import { makeTestDb } from "./helpers/db";

// The retry cron and the moderator queue run on a timer or behind a page, and
// Turso bills per row scanned. These pin the plans of the exact query shapes in
// content-retry.ts and moderation-review.ts so a schema edit can't quietly turn
// a seek into a scan.
async function plan(db: Db, query: string) {
  const rows = await db.all<{ detail: string }>(
    sql.raw(`EXPLAIN QUERY PLAN ${query}`),
  );
  return rows.map((r) => r.detail).join(" | ");
}

describe("moderation indexes", () => {
  let db: Db;

  beforeAll(async () => {
    db = await makeTestDb();
  });

  const unclassified = (table: string, time: string, extra = "") =>
    `SELECT id FROM ${table} WHERE ${time} >= 1 AND ${time} <= 2 AND mod_severe IS NULL${extra} ORDER BY ${time} ASC LIMIT 30`;

  it("seeks unclassified posts by time", async () => {
    const detail = await plan(db, unclassified("postTable", "created_at"));
    expect(detail).toContain("post_unclassified_created_idx");
    expect(detail).not.toContain("TEMP B-TREE");
  });

  it("seeks unclassified comments by time", async () => {
    const detail = await plan(db, unclassified("post_comment", "created_at"));
    expect(detail).toContain("post_comment_unclassified_created_idx");
    expect(detail).not.toContain("TEMP B-TREE");
  });

  // The cron's real comment query also joins the parent post; the join must not
  // push the planner off the partial index onto a scan plus sort.
  it("keeps the unclassified comment seek when joined to its post", async () => {
    const detail = await plan(
      db,
      `SELECT c.id FROM post_comment c INNER JOIN postTable p ON p.id = c.post_id WHERE c.created_at >= 1 AND c.created_at <= 2 AND c.mod_severe IS NULL ORDER BY c.created_at ASC LIMIT 30`,
    );
    expect(detail).toContain("post_comment_unclassified_created_idx");
    expect(detail).not.toContain("TEMP B-TREE");
  });

  it("seeks unclassified notes by update time", async () => {
    const detail = await plan(
      db,
      unclassified("note", "updated_at", " AND content <> ''"),
    );
    expect(detail).toContain("note_unclassified_updated_idx");
    expect(detail).not.toContain("TEMP B-TREE");
  });

  it.each([
    ["postTable", "post_mod_pending_idx"],
    ["post_comment", "post_comment_mod_pending_idx"],
    ["note", "note_mod_pending_idx"],
  ])(
    "serves the severe queue for %s from its pending index",
    async (table, index) => {
      const detail = await plan(
        db,
        `SELECT id FROM ${table} WHERE mod_flagged_at IS NOT NULL AND mod_cleared_at IS NULL AND mod_reviewed_at IS NULL ORDER BY mod_flagged_at DESC, id DESC LIMIT 21`,
      );
      expect(detail).toContain(index);
      expect(detail).not.toContain("TEMP B-TREE");
    },
  );

  it("walks the newest comments by rowid without a sort", async () => {
    const detail = await plan(
      db,
      "SELECT id FROM post_comment ORDER BY rowid DESC LIMIT 200",
    );
    expect(detail).not.toContain("TEMP B-TREE");
  });
});
