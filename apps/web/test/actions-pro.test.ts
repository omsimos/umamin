import { beforeEach, describe, expect, it, vi } from "vitest";

// See actions-post.test.ts — stub the wasm-backed argon2 module (unused here).
vi.mock("../src/server-lib/argon2", () => ({
  hash: async () => "",
  verify: async () => false,
}));

import { userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import { IMAGE_AURA_REQUIRED_ERROR } from "../src/lib/post-images";
import {
  PRO_CHECKOUT_UNAVAILABLE_ERROR,
  PRO_REQUIRED_ERROR,
} from "../src/lib/pro";
import type { Db } from "../src/server-lib/db";
import { __clearSessionCache } from "../src/server-lib/session";
import { authed, buildApp, callJson } from "./helpers/actions";
import { makeTestDb } from "./helpers/db";

const DAY = 24 * 60 * 60 * 1000;
const FUTURE = new Date(Date.now() + 30 * DAY);
const PAST = new Date(Date.now() - DAY);

async function storedTheme(db: Db): Promise<string | null> {
  const [row] = await db
    .select({ profileTheme: userTable.profileTheme })
    .from(userTable)
    .where(eq(userTable.id, "buyer"));
  return row?.profileTheme ?? null;
}

describe("pro actions (real libSQL)", () => {
  let db: Db;

  beforeEach(async () => {
    __clearSessionCache();
    db = await makeTestDb();
    await db.insert(userTable).values({ id: "buyer", username: "u_buyer" });
  });

  it("lets an active Pro equip a theme and persists it", async () => {
    const app = buildApp(db, authed("buyer", { proUntil: FUTURE }));
    const { json } = await callJson<{ success: true; theme: string }>(
      app,
      "updateProfileThemeAction",
      { theme: "ocean" },
    );

    expect(json).toMatchObject({ success: true, theme: "ocean" });
    expect(await storedTheme(db)).toBe("ocean");
  });

  it("rejects equipping once the Pro horizon has passed", async () => {
    const app = buildApp(db, authed("buyer", { proUntil: PAST }));
    const { json } = await callJson<{ error: string }>(
      app,
      "updateProfileThemeAction",
      { theme: "ocean" },
    );

    expect(json).toEqual({ error: PRO_REQUIRED_ERROR });
    expect(await storedTheme(db)).toBeNull();
  });

  it("always allows clearing — a lapsed Pro can remove a stored theme", async () => {
    await db
      .update(userTable)
      .set({ profileTheme: "ember" })
      .where(eq(userTable.id, "buyer"));

    const app = buildApp(db, authed("buyer", { proUntil: PAST }));
    const { json } = await callJson<{ success: true }>(
      app,
      "updateProfileThemeAction",
      { theme: null },
    );

    expect(json).toMatchObject({ success: true, theme: null });
    expect(await storedTheme(db)).toBeNull();
  });

  it("rejects tokens outside the curated palette at the schema", async () => {
    const app = buildApp(db, authed("buyer", { proUntil: FUTURE }));
    const { status } = await callJson(app, "updateProfileThemeAction", {
      theme: "glitter",
    });

    expect(status).toBe(400);
    expect(await storedTheme(db)).toBeNull();
  });

  // The aura bar keeps zero-history throwaway accounts from posting images; a
  // paid account isn't one, so an active Pro skips it. presignPostImages
  // checks R2 BEFORE the gate, so these need credentials well-formed enough
  // for createR2 to return a client (it presigns locally, no network).
  const R2_ENV = {
    R2_ACCOUNT_ID: "a".repeat(32),
    R2_ACCESS_KEY_ID: "b".repeat(32),
    R2_SECRET_ACCESS_KEY: "c".repeat(64),
    R2_BUCKET: "umamin",
    R2_PUBLIC_URL: "https://cdn.example.com",
  };
  const oneImage = {
    images: [{ contentType: "image/webp", contentLength: 1024 }],
  };

  it("lets a zero-aura Pro past the image gate", async () => {
    const app = buildApp(db, authed("buyer", { points: 0, proUntil: FUTURE }));
    const { json } = await callJson<{ success: true; uploads: unknown[] }>(
      app,
      "presignPostImagesAction",
      oneImage,
      R2_ENV,
    );

    expect(json).toMatchObject({ success: true });
    expect(json.uploads).toHaveLength(1);
  });

  it("still blocks a zero-aura account whose Pro expired", async () => {
    const app = buildApp(db, authed("buyer", { points: 0, proUntil: PAST }));
    const { json } = await callJson<{ error: string }>(
      app,
      "presignPostImagesAction",
      oneImage,
      R2_ENV,
    );

    expect(json).toEqual({ error: IMAGE_AURA_REQUIRED_ERROR });
  });

  it("returns the friendly error when checkout is unconfigured", async () => {
    const app = buildApp(db, authed("buyer", {}));
    const { json } = await callJson<{ error: string }>(
      app,
      "createProCheckoutAction",
    );

    expect(json).toEqual({ error: PRO_CHECKOUT_UNAVAILABLE_ERROR });
  });
});
