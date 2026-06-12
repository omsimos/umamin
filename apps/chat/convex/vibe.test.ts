import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { GAME_DECKS } from "./decks";
import schema from "./schema";
import {
  computeVibe,
  EMPTY_VIBE_COUNTERS,
  VIBE_LEVEL_THRESHOLDS,
  VIBE_MSG_COUNT_CAP,
} from "./vibe";

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
  await t.mutation(api.match.enqueueAndMatch, self("a"));
  await t.mutation(api.match.enqueueAndMatch, self("b"));
  return t;
}

const setCounters = (
  t: ReturnType<typeof convexTest>,
  counters: Partial<typeof EMPTY_VIBE_COUNTERS>,
) =>
  t.run(async (ctx) => {
    const match = await ctx.db.query("matches").first();
    if (!match) throw new Error("no match");
    await ctx.db.patch(match._id, {
      vibe: { ...EMPTY_VIBE_COUNTERS, ...counters },
    });
  });

const rawCounters = (t: ReturnType<typeof convexTest>) =>
  t.run(async (ctx) => (await ctx.db.query("matches").first())?.vibe);

const score = async (t: ReturnType<typeof convexTest>, id: string) =>
  (await t.query(api.chat.snapshot, auth(id))).vibe;

describe("computeVibe", () => {
  it("levels follow the thresholds", () => {
    const base = {
      ...EMPTY_VIBE_COUNTERS,
      rounds: 0,
      successes: 0,
      mutualStayConnected: false,
    };
    expect(computeVibe(base)).toEqual({ score: 0, level: 1 });
    // 13 message pairs = 26 points -> level 2 (threshold 25).
    expect(computeVibe({ ...base, msgsA: 13, msgsB: 13 }).level).toBe(2);
    // Saturation clamps the pair component.
    expect(computeVibe({ ...base, msgsA: 500, msgsB: 500 }).score).toBe(
      2 * VIBE_MSG_COUNT_CAP,
    );
  });

  it("a monologue fills nothing", () => {
    const lonely = computeVibe({
      ...EMPTY_VIBE_COUNTERS,
      msgsA: 30,
      rounds: 0,
      successes: 0,
      mutualStayConnected: false,
    });
    expect(lonely.score).toBe(0);
  });
});

describe("vibe on the match", () => {
  it("is identical for both viewers", async () => {
    const t = await matched();
    await t.mutation(api.chat.send, { ...auth("a"), text: "hey" });
    await t.mutation(api.chat.send, { ...auth("b"), text: "hi!" });
    const [msg] = await t.query(api.chat.messages, auth("a"));
    await t.mutation(api.chat.react, {
      ...auth("b"),
      messageId: msg.id,
      emoji: "🔥",
    });
    expect(await score(t, "a")).toEqual(await score(t, "b"));
    expect((await score(t, "a")).score).toBeGreaterThan(0);
  });

  it("messages only count in two-sided pairs", async () => {
    const t = await matched();
    for (const text of ["one", "two", "three"]) {
      await t.mutation(api.chat.send, { ...auth("a"), text });
    }
    expect((await score(t, "a")).score).toBe(0);
    await t.mutation(api.chat.send, { ...auth("b"), text: "finally" });
    expect((await score(t, "a")).score).toBe(2);
  });

  it("reaction sets bump; toggling off never decrements", async () => {
    const t = await matched();
    await t.mutation(api.chat.send, { ...auth("a"), text: "hey" });
    const [msg] = await t.query(api.chat.messages, auth("a"));
    const before = (await score(t, "a")).score;
    await t.mutation(api.chat.react, {
      ...auth("b"),
      messageId: msg.id,
      emoji: "🔥",
    });
    expect((await score(t, "a")).score).toBe(before + 2);
    // Toggle off — the counter holds.
    await t.mutation(api.chat.react, {
      ...auth("b"),
      messageId: msg.id,
      emoji: "🔥",
    });
    expect((await score(t, "a")).score).toBe(before + 2);
  });

  it("a whisper reveal bumps the meter", async () => {
    const t = await matched();
    await t.mutation(api.chat.send, {
      ...auth("a"),
      text: "psst",
      whisper: true,
    });
    const [msg] = await t.query(api.chat.messages, auth("b"));
    const before = (await score(t, "b")).score;
    await t.mutation(api.chat.viewWhisper, { ...auth("b"), messageId: msg.id });
    expect((await score(t, "b")).score).toBe(before + 6);
  });

  it("message counters saturate and stop writing", async () => {
    const t = await matched();
    await setCounters(t, { msgsA: VIBE_MSG_COUNT_CAP });
    await t.mutation(api.chat.send, { ...auth("a"), text: "over the cap" });
    expect((await rawCounters(t))?.msgsA).toBe(VIBE_MSG_COUNT_CAP);
  });

  it("mutual stay-connected adds its bonus", async () => {
    const t = await matched();
    const before = (await score(t, "a")).score;
    await t.mutation(api.chat.signalStayConnected, auth("a"));
    expect((await score(t, "a")).score).toBe(before); // one-sided: no bonus
    await t.mutation(api.chat.signalStayConnected, auth("b"));
    expect((await score(t, "a")).score).toBe(before + 20);
  });

  it("completed rounds and successes raise the score", async () => {
    const t = await matched();
    const card = GAME_DECKS["this-or-that"][0].id;
    await t.mutation(api.games.dealCard, { ...auth("a"), cardId: card });
    for (const id of ["a", "b"]) {
      await t.mutation(api.games.answerCard, {
        ...auth(id),
        cardId: card,
        pick: "A",
      });
    }
    // 5 for the round + 5 for the matched answers.
    expect((await score(t, "a")).score).toBe(10);
  });
});

describe("unlock gates", () => {
  it("rejects a locked effect at level 1 and allows it at level", async () => {
    const t = await matched();
    await expect(
      t.mutation(api.chat.send, {
        ...auth("a"),
        text: "shiny",
        effect: "sparkles",
      }),
    ).rejects.toThrow(/Effect locked/);
    await setCounters(t, { msgsA: 60, msgsB: 60, reactions: 10 });
    await t.mutation(api.chat.send, {
      ...auth("a"),
      text: "shiny",
      effect: "sparkles",
    });
    const msgs = await t.query(api.chat.messages, auth("a"));
    expect(msgs.at(-1)?.effect).toBe("sparkles");
  });

  it("rejects a locked reaction at level 1 and allows it at level", async () => {
    const t = await matched();
    await t.mutation(api.chat.send, { ...auth("a"), text: "hello" });
    const [msg] = await t.query(api.chat.messages, auth("a"));
    await expect(
      t.mutation(api.chat.react, {
        ...auth("b"),
        messageId: msg.id,
        emoji: "🫶",
      }),
    ).rejects.toThrow(/Reaction locked/);
    await setCounters(t, { msgsA: 60, msgsB: 60 });
    await t.mutation(api.chat.react, {
      ...auth("b"),
      messageId: msg.id,
      emoji: "🫶",
    });
    const [after] = await t.query(api.chat.messages, auth("a"));
    expect(after.reactions).toEqual([{ emoji: "🫶", by: "partner" }]);
  });

  it("rejects locked decks and guess mode below their levels", async () => {
    const t = await matched();
    await expect(
      t.mutation(api.games.dealCard, {
        ...auth("a"),
        cardId: GAME_DECKS["hot-takes"][0].id,
      }),
    ).rejects.toThrow(/Locked/);
    await expect(
      t.mutation(api.games.dealCard, {
        ...auth("a"),
        cardId: GAME_DECKS["this-or-that"][0].id,
        mode: "guess",
      }),
    ).rejects.toThrow(/Locked/);
    // The base decks stay open at level 1.
    await t.mutation(api.games.dealCard, {
      ...auth("a"),
      cardId: GAME_DECKS["this-or-that"][0].id,
    });
    expect((await t.query(api.chat.snapshot, auth("a"))).game?.cardId).toBe(
      GAME_DECKS["this-or-that"][0].id,
    );
  });

  it("levels line up with the threshold table", () => {
    expect(VIBE_LEVEL_THRESHOLDS).toHaveLength(5);
  });
});
