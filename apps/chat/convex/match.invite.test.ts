import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { MAX_INVITE_CODE_LEN } from "./constants";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const self = (id: string, interests = ["music"]) => ({
  sessionId: id,
  sessionSecret: `${id}-secret`,
  alias: id,
  avatarSeed: id,
  interests,
});
const auth = (id: string) => ({ sessionId: id, sessionSecret: `${id}-secret` });

function fresh() {
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  return t;
}

describe("invite deep links", () => {
  it("stamps the host's invite code on their queue row", async () => {
    const t = fresh();
    await t.mutation(api.match.enqueueAndMatch, {
      ...self("host"),
      inviteCode: "host-code",
    });
    const row = await t.run(async (ctx) => ctx.db.query("queue").unique());
    expect(row?.inviteCode).toBe("host-code");
  });

  it("a visitor with the host's code lands directly on the host", async () => {
    const t = fresh();
    await t.mutation(api.match.enqueueAndMatch, {
      ...self("host"),
      inviteCode: "host-code",
    });
    const result = await t.mutation(api.match.enqueueAndMatch, {
      ...self("visitor", []),
      joinCode: "host-code",
    });
    expect(result).toEqual({ viaInvite: true });
    const v = await t.query(api.chat.snapshot, auth("visitor"));
    expect(v.phase).toBe("active");
    expect(v.partner?.alias).toBe("host");
  });

  it("a join skips the interest filter (no overlap required)", async () => {
    const t = fresh();
    await t.mutation(api.match.enqueueAndMatch, {
      ...self("host", ["movies"]),
      inviteCode: "host-code",
    });
    const result = await t.mutation(api.match.enqueueAndMatch, {
      ...self("visitor", ["music"]),
      joinCode: "host-code",
    });
    expect(result).toEqual({ viaInvite: true });
    const v = await t.query(api.chat.snapshot, auth("visitor"));
    expect(v.partner?.sharedInterests).toEqual([]);
  });

  it("a stale host row falls back to the normal flow without deleting it", async () => {
    const t = fresh();
    await t.mutation(api.match.enqueueAndMatch, {
      ...self("host"),
      inviteCode: "host-code",
    });
    await t.run(async (ctx) => {
      const row = await ctx.db.query("queue").unique();
      if (row) await ctx.db.patch(row._id, { lastPingAt: 1, enqueuedAt: 1 });
    });
    const result = await t.mutation(api.match.enqueueAndMatch, {
      ...self("visitor"),
      joinCode: "host-code",
    });
    expect(result).toEqual({ viaInvite: false });
    // The visitor queued (no fresh partner at all); the stale row survives.
    const rows = await t.run(async (ctx) => ctx.db.query("queue").collect());
    expect(rows.map((r) => r.sessionId).sort()).toEqual(["host", "visitor"]);
  });

  it("an unknown code falls back to the normal interest flow", async () => {
    const t = fresh();
    await t.mutation(api.match.enqueueAndMatch, self("a"));
    const result = await t.mutation(api.match.enqueueAndMatch, {
      ...self("b"),
      joinCode: "no-such-code",
    });
    // Normal interest-overlap pairing still happened.
    expect(result).toEqual({ viaInvite: false });
    const b = await t.query(api.chat.snapshot, auth("b"));
    expect(b.phase).toBe("active");
  });

  it("your own code cannot match you with yourself", async () => {
    const t = fresh();
    await t.mutation(api.match.enqueueAndMatch, {
      ...self("host"),
      inviteCode: "host-code",
    });
    const result = await t.mutation(api.match.enqueueAndMatch, {
      ...self("host"),
      inviteCode: "host-code",
      joinCode: "host-code",
    });
    expect(result).toEqual({ viaInvite: false });
    const s = await t.query(api.chat.snapshot, auth("host"));
    expect(s.phase).toBe("matching");
  });

  it("a host already in a match is simply not claimable", async () => {
    const t = fresh();
    await t.mutation(api.match.enqueueAndMatch, {
      ...self("host"),
      inviteCode: "host-code",
    });
    await t.mutation(api.match.enqueueAndMatch, self("a")); // pairs with host
    const result = await t.mutation(api.match.enqueueAndMatch, {
      ...self("visitor"),
      joinCode: "host-code",
    });
    expect(result).toEqual({ viaInvite: false });
  });

  it("rejects over-long codes and persists nothing for them", async () => {
    const t = fresh();
    await expect(
      t.mutation(api.match.enqueueAndMatch, {
        ...self("host"),
        inviteCode: "x".repeat(MAX_INVITE_CODE_LEN + 1),
      }),
    ).rejects.toThrow(/Invalid invite code/);
    await expect(
      t.mutation(api.match.enqueueAndMatch, {
        ...self("visitor"),
        joinCode: "x".repeat(MAX_INVITE_CODE_LEN + 1),
      }),
    ).rejects.toThrow(/Invalid invite code/);
    const rows = await t.run(async (ctx) => ctx.db.query("queue").collect());
    expect(rows).toHaveLength(0);
  });

  it("an empty code is treated as absent", async () => {
    const t = fresh();
    const result = await t.mutation(api.match.enqueueAndMatch, {
      ...self("host"),
      inviteCode: "  ",
      joinCode: "",
    });
    expect(result).toEqual({ viaInvite: false });
    const row = await t.run(async (ctx) => ctx.db.query("queue").unique());
    expect(row?.inviteCode).toBeUndefined();
  });
});
