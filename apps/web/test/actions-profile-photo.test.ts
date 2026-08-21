import { beforeEach, describe, expect, it, vi } from "vitest";

// argon2's precompiled .wasm import only resolves in the workers pool; this
// node-pool suite pulls argon2 in transitively via actionsApp but never calls it.
vi.mock("../src/server-lib/argon2", () => ({
  hash: async () => "",
  verify: async () => false,
}));

import { userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import type { Db } from "../src/server-lib/db";
import { authed, buildApp, call, callJson } from "./helpers/actions";
import { makeTestDb } from "./helpers/db";

const GOOGLE_PHOTO = "https://lh3.googleusercontent.com/a/abc123";

async function seedUser(db: Db, imageUrl: string | null) {
  await db
    .insert(userTable)
    .values({ id: "user_1", username: "alice", imageUrl });
}

const imageUrlOf = (db: Db) =>
  db
    .select({ imageUrl: userTable.imageUrl })
    .from(userTable)
    .where(eq(userTable.id, "user_1"))
    .then(([row]) => row?.imageUrl);

describe("profile photo actions (real libSQL)", () => {
  let db: Db;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("removes an uploaded photo, falling back to the default picture", async () => {
    await seedUser(db, "https://cdn.test/avatars/alice.webp");

    const { json } = await callJson(
      buildApp(db, authed("user_1")),
      "removeProfilePhotoAction",
    );

    expect(json).toEqual({ success: true });
    expect(await imageUrlOf(db)).toBeNull();
  });

  it("removes a Google photo left over from an older signup", async () => {
    // Accounts created before the signup path stopped adopting the Google photo
    // still carry one, and this is the only way they can clear it now that
    // "Use Google Photo" and the Display Picture toggle are gone.
    await seedUser(db, GOOGLE_PHOTO);

    await call(buildApp(db, authed("user_1")), "removeProfilePhotoAction");

    expect(await imageUrlOf(db)).toBeNull();
  });

  it("requires a session", async () => {
    await seedUser(db, GOOGLE_PHOTO);

    const res = await call(
      buildApp(db, { session: null, user: null, source: null }),
      "removeProfilePhotoAction",
    );

    expect(res.status).toBe(401);
    expect(await imageUrlOf(db)).toBe(GOOGLE_PHOTO);
  });

  // No action applies an avatar by URL any more: photos come from the R2 upload
  // path, and everything else is the account's own blobatar. Re-adding either
  // endpoint re-opens the raw <img src> tracking vector the host allowlist
  // used to guard.
  it.each([
    "updateAvatarAction",
    "toggleDisplayPictureAction",
  ])("no longer exposes %s", async (name) => {
    await seedUser(db, null);

    const res = await call(buildApp(db, authed("user_1")), name, GOOGLE_PHOTO);

    expect(res.status).toBe(404);
    expect(await imageUrlOf(db)).toBeNull();
  });
});
