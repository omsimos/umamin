import { beforeEach, describe, expect, it, vi } from "vitest";

// argon2's precompiled .wasm import only resolves in the workers pool; this
// node-pool suite pulls argon2 in transitively via actionsApp but never calls it.
vi.mock("../src/server-lib/argon2", () => ({
  hash: async () => "",
  verify: async () => false,
}));

import { moderationDisputeTable } from "@umamin/db/schema/moderation-dispute";
import { noteReactionTable, noteTable } from "@umamin/db/schema/note";
import { userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import type { Db } from "../src/server-lib/db";
import { __clearSessionCache } from "../src/server-lib/session";
import { authed, buildApp, callJson } from "./helpers/actions";
import { makeTestDb } from "./helpers/db";

describe("saving a note (real libSQL)", () => {
  let db: Db;

  beforeEach(async () => {
    __clearSessionCache();
    db = await makeTestDb();
    await db.insert(userTable).values([
      { id: "u1", username: "u_u1" },
      { id: "u2", username: "u_u2" },
      { id: "u3", username: "u_u3" },
    ]);
  });

  async function save(userId: string, content: string) {
    const { json } = await callJson<{ success?: boolean }>(
      buildApp(db, authed(userId)),
      "createNoteAction",
      { content },
    );
    expect(json.success).toBe(true);
    const [note] = await db
      .select({ id: noteTable.id, reactionCount: noteTable.reactionCount })
      .from(noteTable)
      .where(eq(noteTable.userId, userId));
    return note;
  }

  async function react(noteId: string, userId: string) {
    await db.insert(noteReactionTable).values({ noteId, userId });
    await db
      .update(noteTable)
      .set({ reactionCount: 1 })
      .where(eq(noteTable.id, noteId));
  }

  it("re-saving a note clears its reactions", async () => {
    const first = await save("u1", "hello");
    await react(first.id, "u3");

    const again = await save("u1", "hello again");

    expect(again.id).toBe(first.id);
    expect(again.reactionCount).toBe(0);
    expect(await db.select().from(noteReactionTable)).toHaveLength(0);
  });

  it("re-saving a note clears its disputes", async () => {
    const first = await save("u1", "hello");
    await db
      .insert(moderationDisputeTable)
      .values({ kind: "note", targetId: first.id, userId: "u3" });

    await save("u1", "hello again");

    expect(await db.select().from(moderationDisputeTable)).toHaveLength(0);
  });

  it("saving never touches another user's note", async () => {
    const other = await save("u2", "mine");
    await react(other.id, "u3");
    await db
      .insert(moderationDisputeTable)
      .values({ kind: "note", targetId: other.id, userId: "u3" });

    await save("u1", "hello");
    await save("u1", "hello again");

    const reactions = await db.select().from(noteReactionTable);
    expect(reactions.map((r) => r.noteId)).toEqual([other.id]);
    const disputes = await db.select().from(moderationDisputeTable);
    expect(disputes.map((d) => d.targetId)).toEqual([other.id]);
  });
});
