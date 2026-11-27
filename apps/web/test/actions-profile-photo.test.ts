import { beforeEach, describe, expect, it, vi } from "vitest";

// argon2's precompiled .wasm import only resolves in the workers pool; this
// node-pool suite pulls argon2 in transitively via actionsApp but never calls it.
vi.mock("../src/server-lib/argon2", () => ({
  hash: async () => "",
  verify: async () => false,
}));

// Real R2 factory by default (no credentials, so it returns null); a test can
// hand back a fake bucket client.
const { createR2 } = vi.hoisted(() => ({ createR2: vi.fn() }));
vi.mock("../src/server-lib/r2", async (importActual) => {
  const actual = await importActual<typeof import("../src/server-lib/r2")>();
  createR2.mockImplementation(actual.createR2);
  return { ...actual, createR2 };
});

import { userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import type { Db } from "../src/server-lib/db";
import { authed, buildApp, call, callJson } from "./helpers/actions";
import { makeTestDb } from "./helpers/db";
import { commitThenFail, failTransaction } from "./helpers/flaky-db";

const GOOGLE_PHOTO = "https://lh3.googleusercontent.com/a/abc123";

async function seedUser(db: Db, imageUrl: string | null) {
  await db
    .insert(userTable)
    .values({ id: "user_1", username: "alice", imageUrl });
}

const bannerUrlOf = (db: Db) =>
  db
    .select({ bannerImageUrl: userTable.bannerImageUrl })
    .from(userTable)
    .where(eq(userTable.id, "user_1"))
    .then(([row]) => row?.bannerImageUrl);

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
  it.each(["updateAvatarAction", "toggleDisplayPictureAction"])(
    "no longer exposes %s",
    async (name) => {
      await seedUser(db, null);

      const res = await call(
        buildApp(db, authed("user_1")),
        name,
        GOOGLE_PHOTO,
      );

      expect(res.status).toBe(404);
      expect(await imageUrlOf(db)).toBeNull();
    },
  );

  describe("a new photo or banner when the write errors", () => {
    const CDN = "https://cdn.test";
    const OLD_AVATAR = `${CDN}/avatars/user_1/old.webp`;
    const OLD_BANNER = `${CDN}/banners/user_1/old.webp`;
    const NEW_AVATAR = `${CDN}/avatars/user_1/new.webp`;
    const NEW_BANNER = `${CDN}/banners/user_1/new.webp`;

    const fakeR2 = () => ({
      claimStagedAvatar: vi.fn(async () => "avatars/user_1/new.webp"),
      claimStagedBanner: vi.fn(async () => "banners/user_1/new.webp"),
      deleteR2Avatar: vi.fn(async () => {}),
      deleteR2Banner: vi.fn(async () => {}),
    });

    beforeEach(async () => {
      await seedUser(db, OLD_AVATAR);
      await db
        .update(userTable)
        .set({ bannerImageUrl: OLD_BANNER })
        .where(eq(userTable.id, "user_1"));
    });

    const save = (target: Db, name: string) =>
      call(
        buildApp(target, authed("user_1")),
        name,
        { key: "staging/user_1/x.webp" },
        { R2_PUBLIC_URL: CDN },
      );

    it("keeps a photo that was saved before the error", async () => {
      const r2 = fakeR2();
      createR2.mockReturnValueOnce(r2);

      const res = await save(commitThenFail(db), "updateProfilePhotoAction");

      expect(res.status).toBe(500);
      expect(await imageUrlOf(db)).toBe(NEW_AVATAR);
      expect(r2.deleteR2Avatar).not.toHaveBeenCalledWith(NEW_AVATAR);
    });

    it("keeps a banner that was saved before the error", async () => {
      const r2 = fakeR2();
      createR2.mockReturnValueOnce(r2);

      const res = await save(commitThenFail(db), "updateProfileBannerAction");

      expect(res.status).toBe(500);
      expect(await bannerUrlOf(db)).toBe(NEW_BANNER);
      expect(r2.deleteR2Banner).not.toHaveBeenCalledWith(NEW_BANNER);
    });

    it("keeps the new objects when the profile can't be read back", async () => {
      const r2 = fakeR2();
      createR2.mockReturnValueOnce(r2).mockReturnValueOnce(r2);
      const flaky = () => commitThenFail(db, { failReadsAfter: true });

      await save(flaky(), "updateProfilePhotoAction");
      await save(flaky(), "updateProfileBannerAction");

      expect(r2.deleteR2Avatar).not.toHaveBeenCalledWith(NEW_AVATAR);
      expect(r2.deleteR2Banner).not.toHaveBeenCalledWith(NEW_BANNER);
    });

    it("deletes the new objects when nothing was saved", async () => {
      const r2 = fakeR2();
      createR2.mockReturnValueOnce(r2).mockReturnValueOnce(r2);

      await save(failTransaction(db), "updateProfilePhotoAction");
      await save(failTransaction(db), "updateProfileBannerAction");

      expect(await imageUrlOf(db)).toBe(OLD_AVATAR);
      expect(await bannerUrlOf(db)).toBe(OLD_BANNER);
      expect(r2.deleteR2Avatar).toHaveBeenCalledWith(NEW_AVATAR);
      expect(r2.deleteR2Banner).toHaveBeenCalledWith(NEW_BANNER);
    });
  });
});
