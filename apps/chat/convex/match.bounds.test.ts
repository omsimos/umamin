import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import {
  MAX_ALIAS_LEN,
  MAX_AVATAR_SEED_LEN,
  MAX_INTEREST_LEN,
  MAX_INTERESTS,
} from "./constants";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

function setup() {
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  return t;
}

const base = {
  sessionId: "a",
  sessionSecret: "a-secret",
  alias: "a",
  avatarSeed: "seed",
  interests: ["music"],
};

const sessionRow = (t: ReturnType<typeof convexTest>) =>
  t.run((ctx) =>
    ctx.db
      .query("sessions")
      .withIndex("by_session", (q) => q.eq("sessionId", "a"))
      .unique(),
  );

// `normalizeIdentity` runs inside the publicly callable `enqueueAndMatch`, so the
// lobby's UX caps are not the real guard — the server must reject oversized input.
describe("enqueueAndMatch identity bounds (server-side guard)", () => {
  it("rejects an empty avatarSeed (after trim) and persists no session", async () => {
    const t = setup();
    await expect(
      t.mutation(api.match.enqueueAndMatch, { ...base, avatarSeed: "   " }),
    ).rejects.toThrow(/invalid identity/i);
    expect(await sessionRow(t)).toBeNull();
  });

  it("rejects an alias longer than MAX_ALIAS_LEN", async () => {
    const t = setup();
    await expect(
      t.mutation(api.match.enqueueAndMatch, {
        ...base,
        alias: "x".repeat(MAX_ALIAS_LEN + 1),
      }),
    ).rejects.toThrow(/invalid identity/i);
  });

  it("accepts an alias exactly at MAX_ALIAS_LEN (boundary inclusive)", async () => {
    const t = setup();
    const alias = "x".repeat(MAX_ALIAS_LEN);
    await t.mutation(api.match.enqueueAndMatch, { ...base, alias });
    expect(await sessionRow(t)).toMatchObject({ alias });
  });

  it("rejects an avatarSeed longer than MAX_AVATAR_SEED_LEN", async () => {
    const t = setup();
    await expect(
      t.mutation(api.match.enqueueAndMatch, {
        ...base,
        avatarSeed: "x".repeat(MAX_AVATAR_SEED_LEN + 1),
      }),
    ).rejects.toThrow(/invalid identity/i);
  });

  it("rejects more than MAX_INTERESTS distinct interests", async () => {
    const t = setup();
    const interests = Array.from(
      { length: MAX_INTERESTS + 1 },
      (_, i) => `i${i}`,
    );
    await expect(
      t.mutation(api.match.enqueueAndMatch, { ...base, interests }),
    ).rejects.toThrow(/invalid identity/i);
  });

  it("counts interests after dedup — duplicates over the cap collapse and pass", async () => {
    const t = setup();
    // More raw entries than the cap, but only MAX_INTERESTS distinct values.
    const distinct = Array.from({ length: MAX_INTERESTS }, (_, i) => `i${i}`);
    const interests = [...distinct, ...distinct];
    await t.mutation(api.match.enqueueAndMatch, { ...base, interests });
    const row = await sessionRow(t);
    expect(row?.interests).toHaveLength(MAX_INTERESTS);
  });

  it("rejects a single interest longer than MAX_INTEREST_LEN", async () => {
    const t = setup();
    await expect(
      t.mutation(api.match.enqueueAndMatch, {
        ...base,
        interests: ["music", "x".repeat(MAX_INTEREST_LEN + 1)],
      }),
    ).rejects.toThrow(/invalid identity/i);
  });

  it("measures interest length after trim — surrounding whitespace does not trip the cap", async () => {
    const t = setup();
    const value = "x".repeat(MAX_INTEREST_LEN);
    await t.mutation(api.match.enqueueAndMatch, {
      ...base,
      interests: [`  ${value}  `],
    });
    const row = await sessionRow(t);
    expect(row?.interests).toEqual([value]);
  });
});
