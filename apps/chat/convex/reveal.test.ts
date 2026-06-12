import { register as registerPresence } from "@convex-dev/presence/test";
import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import { MAX_REVEAL_HANDLE_LEN } from "./constants";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const self = (id: string) => ({
  sessionId: id,
  sessionSecret: `${id}-secret`,
  alias: id,
  avatarSeed: id,
  interests: ["music"],
});
const auth = (id: string) => ({ sessionId: id, sessionSecret: `${id}-secret` });

async function matched() {
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  registerPresence(t);
  await t.mutation(api.match.enqueueAndMatch, self("a"));
  await t.mutation(api.match.enqueueAndMatch, self("b"));
  return t;
}

async function mutual() {
  const t = await matched();
  await t.mutation(api.chat.signalStayConnected, auth("a"));
  await t.mutation(api.chat.signalStayConnected, auth("b"));
  return t;
}

const reveal = async (t: Awaited<ReturnType<typeof matched>>, id: string) =>
  (await t.query(api.chat.snapshot, auth(id))).reveal;

// Keyed by sessionId — pairing order decides which session lands on the
// match's A/B side, so the columns can't be assumed.
const rawHandles = (t: Awaited<ReturnType<typeof matched>>) =>
  t.run(async (ctx) => {
    const match = await ctx.db.query("matches").first();
    if (!match) return {} as Record<string, string | undefined>;
    return {
      [match.a]: match.revealA,
      [match.b]: match.revealB,
    } as Record<string, string | undefined>;
  });

describe("reveal", () => {
  it("is locked until BOTH sides signal stay-connected", async () => {
    const t = await matched();
    await t.mutation(api.chat.signalStayConnected, auth("a"));
    await expect(
      t.mutation(api.reveal.submitReveal, { ...auth("a"), handle: "@me" }),
    ).rejects.toThrow(/Not unlocked/);
    expect(await rawHandles(t)).toEqual({ a: undefined, b: undefined });
    expect((await reveal(t, "a")).unlocked).toBe(false);
  });

  it("one submission shows THAT, never WHAT (anti-leak)", async () => {
    const t = await mutual();
    await t.mutation(api.reveal.submitReveal, { ...auth("a"), handle: "@me" });
    // Own echo is reload-safe.
    const a = await reveal(t, "a");
    expect(a.self).toEqual({ submitted: true, handle: "@me" });
    expect(a.partner).toEqual({ submitted: false });
    // The partner learns a handle exists — not its value.
    const b = await reveal(t, "b");
    expect(b.partner).toEqual({ submitted: true });
    expect(b.self).toEqual({ submitted: false });
  });

  it("both submissions reveal both handles, viewer-relative", async () => {
    const t = await mutual();
    await t.mutation(api.reveal.submitReveal, { ...auth("a"), handle: "@aa" });
    await t.mutation(api.reveal.submitReveal, { ...auth("b"), handle: "@bb" });
    const a = await reveal(t, "a");
    expect(a.self.handle).toBe("@aa");
    expect(a.partner.handle).toBe("@bb");
    const b = await reveal(t, "b");
    expect(b.self.handle).toBe("@bb");
    expect(b.partner.handle).toBe("@aa");
  });

  it("resubmitting replaces pre-reveal; everything freezes post-reveal", async () => {
    const t = await mutual();
    await t.mutation(api.reveal.submitReveal, { ...auth("a"), handle: "@v1" });
    await t.mutation(api.reveal.submitReveal, { ...auth("a"), handle: "@v2" });
    expect((await reveal(t, "a")).self.handle).toBe("@v2");

    await t.mutation(api.reveal.submitReveal, { ...auth("b"), handle: "@bb" });
    // Post-reveal: no bait-and-switch, no withdrawal.
    await t.mutation(api.reveal.submitReveal, { ...auth("a"), handle: "@v3" });
    await t.mutation(api.reveal.withdrawReveal, auth("a"));
    expect(await rawHandles(t)).toEqual({ a: "@v2", b: "@bb" });
  });

  it("withdraw clears the own side pre-reveal", async () => {
    const t = await mutual();
    await t.mutation(api.reveal.submitReveal, { ...auth("a"), handle: "@me" });
    await t.mutation(api.reveal.withdrawReveal, auth("a"));
    expect((await reveal(t, "a")).self).toEqual({ submitted: false });
    expect((await reveal(t, "b")).partner).toEqual({ submitted: false });
  });

  it("bounds the handle and trims whitespace", async () => {
    const t = await mutual();
    await expect(
      t.mutation(api.reveal.submitReveal, {
        ...auth("a"),
        handle: "x".repeat(MAX_REVEAL_HANDLE_LEN + 1),
      }),
    ).rejects.toThrow(/too long/);
    expect(await rawHandles(t)).toEqual({ a: undefined, b: undefined });

    // Whitespace-only is a silent no-op.
    await t.mutation(api.reveal.submitReveal, { ...auth("a"), handle: "   " });
    expect(await rawHandles(t)).toEqual({ a: undefined, b: undefined });

    await t.mutation(api.reveal.submitReveal, {
      ...auth("a"),
      handle: `  ${"x".repeat(MAX_REVEAL_HANDLE_LEN)}  `,
    });
    expect((await rawHandles(t)).a).toBe("x".repeat(MAX_REVEAL_HANDLE_LEN));
  });

  it("a session outside the match cannot write a handle", async () => {
    const t = await mutual();
    await t.mutation(api.match.enqueueAndMatch, self("c"));
    await t.mutation(api.reveal.submitReveal, { ...auth("c"), handle: "@spy" });
    expect(await rawHandles(t)).toEqual({ a: undefined, b: undefined });
  });

  it("an ended match silently refuses new handles", async () => {
    const t = await mutual();
    await t.mutation(api.chat.leave, auth("b"));
    await t.mutation(api.reveal.submitReveal, { ...auth("a"), handle: "@me" });
    expect(await rawHandles(t)).toEqual({ a: undefined, b: undefined });
  });

  it("a mutually-revealed handle survives into the ended grace window", async () => {
    const t = await mutual();
    await t.mutation(api.reveal.submitReveal, { ...auth("a"), handle: "@aa" });
    await t.mutation(api.reveal.submitReveal, { ...auth("b"), handle: "@bb" });
    await t.mutation(api.chat.leave, auth("b"));
    // The survivor's ended snapshot still carries the partner's handle.
    const a = await t.query(api.chat.snapshot, auth("a"));
    expect(a.phase).toBe("ended");
    expect(a.reveal.partner.handle).toBe("@bb");
  });

  it("deleteMatch makes the handle unrecoverable", async () => {
    const t = await mutual();
    await t.mutation(api.reveal.submitReveal, { ...auth("a"), handle: "@aa" });
    await t.mutation(api.reveal.submitReveal, { ...auth("b"), handle: "@bb" });
    const matchId = (await t.query(api.chat.snapshot, auth("a"))).matchId;
    await t.mutation(internal.cleanup.deleteMatch, {
      matchId: matchId as never,
    });
    const rows = await t.run(async (ctx) => ctx.db.query("matches").collect());
    expect(rows).toHaveLength(0);
  });

  it("rate-limits rapid submissions", async () => {
    const t = await mutual();
    await expect(
      (async () => {
        for (let i = 0; i < 6; i += 1) {
          await t.mutation(api.reveal.submitReveal, {
            ...auth("a"),
            handle: `@v${i}`,
          });
        }
      })(),
    ).rejects.toThrow();
  });
});
