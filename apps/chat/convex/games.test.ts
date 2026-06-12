import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { GAME_DECKS } from "./decks";
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

const CARD = GAME_DECKS["this-or-that"][0].id;
const OTHER_CARD = GAME_DECKS["would-you-rather"][0].id;

async function matched() {
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  await t.mutation(api.match.enqueueAndMatch, self("a"));
  await t.mutation(api.match.enqueueAndMatch, self("b"));
  return t;
}

/** Saturate the vibe counters so level gates (guess mode, gated decks) pass. */
const boostVibe = (t: ReturnType<typeof convexTest>) =>
  t.run(async (ctx) => {
    const match = await ctx.db.query("matches").first();
    if (!match) throw new Error("no match to boost");
    await ctx.db.patch(match._id, {
      vibe: { msgsA: 60, msgsB: 60, reactions: 10, whispers: 3 },
    });
  });

describe("games", () => {
  it("deal shows the round to both players, viewer-relative", async () => {
    const t = await matched();
    await t.mutation(api.games.dealCard, { ...auth("a"), cardId: CARD });
    const a = await t.query(api.chat.snapshot, auth("a"));
    expect(a.game).toEqual({
      cardId: CARD,
      dealtBy: "self",
      mode: "match",
      selfPick: null,
      partnerAnswered: false,
    });
    const b = await t.query(api.chat.snapshot, auth("b"));
    expect(b.game?.dealtBy).toBe("partner");
  });

  it("rejects an unknown card id", async () => {
    const t = await matched();
    await expect(
      t.mutation(api.games.dealCard, { ...auth("a"), cardId: "nope" }),
    ).rejects.toThrow(/Unknown card/);
    const a = await t.query(api.chat.snapshot, auth("a"));
    expect(a.game).toBeNull();
  });

  it("withholds the partner's pick until both have answered", async () => {
    const t = await matched();
    await t.mutation(api.games.dealCard, { ...auth("a"), cardId: CARD });
    await t.mutation(api.games.answerCard, {
      ...auth("a"),
      cardId: CARD,
      pick: "A",
    });
    // The answerer sees their own pick, not a reveal.
    const a = await t.query(api.chat.snapshot, auth("a"));
    expect(a.game?.selfPick).toBe("A");
    expect(a.game?.partnerAnswered).toBe(false);
    expect(a.game?.partnerPick).toBeUndefined();
    // Anti-leak: the other side learns THAT a answered, never WHAT.
    const b = await t.query(api.chat.snapshot, auth("b"));
    expect(b.game?.partnerAnswered).toBe(true);
    expect(b.game?.partnerPick).toBeUndefined();
  });

  it("reveals both picks and tallies a match when picks agree", async () => {
    const t = await matched();
    await t.mutation(api.games.dealCard, { ...auth("a"), cardId: CARD });
    await t.mutation(api.games.answerCard, {
      ...auth("a"),
      cardId: CARD,
      pick: "A",
    });
    await t.mutation(api.games.answerCard, {
      ...auth("b"),
      cardId: CARD,
      pick: "A",
    });
    for (const id of ["a", "b"]) {
      const s = await t.query(api.chat.snapshot, auth(id));
      expect(s.game?.selfPick).toBe("A");
      expect(s.game?.partnerPick).toBe("A");
      expect(s.gameTally).toEqual({ rounds: 1, matched: 1 });
    }
  });

  it("records a completed round in the conversation, viewer-relative", async () => {
    const t = await matched();
    await t.mutation(api.games.dealCard, { ...auth("a"), cardId: CARD });
    await t.mutation(api.games.answerCard, {
      ...auth("a"),
      cardId: CARD,
      pick: "A",
    });
    await t.mutation(api.games.answerCard, {
      ...auth("b"),
      cardId: CARD,
      pick: "B",
    });
    const aMsgs = await t.query(api.chat.messages, auth("a"));
    const aRow = aMsgs.at(-1);
    expect(aRow?.text).toBe("");
    expect(aRow?.gameResult).toEqual({
      cardId: CARD,
      selfPick: "A",
      partnerPick: "B",
      dealtBy: "self",
    });
    const bMsgs = await t.query(api.chat.messages, auth("b"));
    expect(bMsgs.at(-1)?.gameResult).toEqual({
      cardId: CARD,
      selfPick: "B",
      partnerPick: "A",
      dealtBy: "partner",
    });
  });

  it("does not record unfinished rounds (one answer, replaced, dismissed)", async () => {
    const t = await matched();
    await t.mutation(api.games.dealCard, { ...auth("a"), cardId: CARD });
    await t.mutation(api.games.answerCard, {
      ...auth("a"),
      cardId: CARD,
      pick: "A",
    });
    expect(await t.query(api.chat.messages, auth("a"))).toHaveLength(0);

    await t.mutation(api.games.dealCard, { ...auth("b"), cardId: OTHER_CARD });
    await t.mutation(api.games.dismissGame, auth("a"));
    expect(await t.query(api.chat.messages, auth("a"))).toHaveLength(0);
  });

  it("the round record outlives a re-deal and a dismiss", async () => {
    const t = await matched();
    await t.mutation(api.games.dealCard, { ...auth("a"), cardId: CARD });
    for (const [id, pick] of [
      ["a", "A"],
      ["b", "A"],
    ] as const) {
      await t.mutation(api.games.answerCard, {
        ...auth(id),
        cardId: CARD,
        pick,
      });
    }
    await t.mutation(api.games.dealCard, { ...auth("a"), cardId: OTHER_CARD });
    await t.mutation(api.games.dismissGame, auth("a"));
    const msgs = await t.query(api.chat.messages, auth("a"));
    expect(msgs.filter((m) => m.gameResult)).toHaveLength(1);
  });

  it("a reply quoting a game row shows a placeholder", async () => {
    const t = await matched();
    await t.mutation(api.games.dealCard, { ...auth("a"), cardId: CARD });
    for (const id of ["a", "b"]) {
      await t.mutation(api.games.answerCard, {
        ...auth(id),
        cardId: CARD,
        pick: "A",
      });
    }
    const [row] = await t.query(api.chat.messages, auth("a"));
    await t.mutation(api.chat.send, {
      ...auth("b"),
      text: "good round",
      replyToId: row.id,
    });
    const msgs = await t.query(api.chat.messages, auth("b"));
    expect(msgs.at(-1)?.replyTo?.text).toBe("⚡ Game round");
  });

  it("tallies a completed round without a match when picks differ", async () => {
    const t = await matched();
    await t.mutation(api.games.dealCard, { ...auth("a"), cardId: CARD });
    await t.mutation(api.games.answerCard, {
      ...auth("a"),
      cardId: CARD,
      pick: "A",
    });
    await t.mutation(api.games.answerCard, {
      ...auth("b"),
      cardId: CARD,
      pick: "B",
    });
    const a = await t.query(api.chat.snapshot, auth("a"));
    expect(a.gameTally).toEqual({ rounds: 1, matched: 0 });
  });

  it("first answer wins — a second answer from the same side no-ops", async () => {
    const t = await matched();
    await t.mutation(api.games.dealCard, { ...auth("a"), cardId: CARD });
    await t.mutation(api.games.answerCard, {
      ...auth("a"),
      cardId: CARD,
      pick: "A",
    });
    await t.mutation(api.games.answerCard, {
      ...auth("a"),
      cardId: CARD,
      pick: "B",
    });
    const a = await t.query(api.chat.snapshot, auth("a"));
    expect(a.game?.selfPick).toBe("A");
  });

  it("an answer for a stale card no-ops", async () => {
    const t = await matched();
    await t.mutation(api.games.dealCard, { ...auth("a"), cardId: CARD });
    await t.mutation(api.games.answerCard, {
      ...auth("b"),
      cardId: OTHER_CARD,
      pick: "A",
    });
    const b = await t.query(api.chat.snapshot, auth("b"));
    expect(b.game?.selfPick).toBeNull();
  });

  it("re-dealing replaces the round and discards in-flight answers", async () => {
    const t = await matched();
    await t.mutation(api.games.dealCard, { ...auth("a"), cardId: CARD });
    await t.mutation(api.games.answerCard, {
      ...auth("a"),
      cardId: CARD,
      pick: "A",
    });
    await t.mutation(api.games.dealCard, { ...auth("b"), cardId: OTHER_CARD });
    const a = await t.query(api.chat.snapshot, auth("a"));
    expect(a.game?.cardId).toBe(OTHER_CARD);
    expect(a.game?.selfPick).toBeNull();
    // The discarded round never reached the tally.
    expect(a.gameTally).toEqual({ rounds: 0, matched: 0 });
  });

  it("dismiss clears the round but keeps the tally", async () => {
    const t = await matched();
    await t.mutation(api.games.dealCard, { ...auth("a"), cardId: CARD });
    for (const id of ["a", "b"]) {
      await t.mutation(api.games.answerCard, {
        ...auth(id),
        cardId: CARD,
        pick: "A",
      });
    }
    await t.mutation(api.games.dismissGame, auth("a"));
    const b = await t.query(api.chat.snapshot, auth("b"));
    expect(b.game).toBeNull();
    expect(b.gameTally).toEqual({ rounds: 1, matched: 1 });
  });

  it("tally accumulates across rounds", async () => {
    const t = await matched();
    const second = GAME_DECKS["this-or-that"][1].id;
    for (const [card, bPick] of [
      [CARD, "A"],
      [second, "B"],
    ] as const) {
      await t.mutation(api.games.dealCard, { ...auth("a"), cardId: card });
      await t.mutation(api.games.answerCard, {
        ...auth("a"),
        cardId: card,
        pick: "A",
      });
      await t.mutation(api.games.answerCard, {
        ...auth("b"),
        cardId: card,
        pick: bPick,
      });
    }
    const a = await t.query(api.chat.snapshot, auth("a"));
    expect(a.gameTally).toEqual({ rounds: 2, matched: 1 });
  });

  it("a session without an active match cannot deal or answer", async () => {
    const t = await matched();
    await t.mutation(api.match.enqueueAndMatch, self("c"));
    await t.mutation(api.games.dealCard, { ...auth("c"), cardId: CARD });
    await t.mutation(api.games.answerCard, {
      ...auth("c"),
      cardId: CARD,
      pick: "A",
    });
    // a+b's match is untouched.
    const a = await t.query(api.chat.snapshot, auth("a"));
    expect(a.game).toBeNull();
  });

  it("rate-limits rapid dealing", async () => {
    const t = await matched();
    const cards = GAME_DECKS["this-or-that"];
    await expect(
      (async () => {
        for (const card of cards.slice(0, 5)) {
          await t.mutation(api.games.dealCard, {
            ...auth("a"),
            cardId: card.id,
          });
        }
      })(),
    ).rejects.toThrow();
  });
});

describe("guess mode (Mind Reader)", () => {
  it("deal carries the mode to both viewers", async () => {
    const t = await matched();
    await boostVibe(t);
    await t.mutation(api.games.dealCard, {
      ...auth("a"),
      cardId: CARD,
      mode: "guess",
    });
    const a = await t.query(api.chat.snapshot, auth("a"));
    expect(a.game?.mode).toBe("guess");
    expect(a.game?.dealtBy).toBe("self");
    const b = await t.query(api.chat.snapshot, auth("b"));
    expect(b.game?.mode).toBe("guess");
    expect(b.game?.dealtBy).toBe("partner");
  });

  it("withholds the dealer's truth until the guess lands", async () => {
    const t = await matched();
    await boostVibe(t);
    await t.mutation(api.games.dealCard, {
      ...auth("a"),
      cardId: CARD,
      mode: "guess",
    });
    await t.mutation(api.games.answerCard, {
      ...auth("a"),
      cardId: CARD,
      pick: "A",
    });
    const b = await t.query(api.chat.snapshot, auth("b"));
    expect(b.game?.partnerAnswered).toBe(true);
    expect(b.game?.partnerPick).toBeUndefined();
  });

  it("a correct guess tallies guessTally and leaves gameTally untouched", async () => {
    const t = await matched();
    await boostVibe(t);
    await t.mutation(api.games.dealCard, {
      ...auth("a"),
      cardId: CARD,
      mode: "guess",
    });
    await t.mutation(api.games.answerCard, {
      ...auth("a"),
      cardId: CARD,
      pick: "A",
    });
    await t.mutation(api.games.answerCard, {
      ...auth("b"),
      cardId: CARD,
      pick: "A",
    });
    const a = await t.query(api.chat.snapshot, auth("a"));
    expect(a.guessTally).toEqual({ rounds: 1, correct: 1 });
    expect(a.gameTally).toEqual({ rounds: 0, matched: 0 });
  });

  it("a wrong guess tallies a round without a hit", async () => {
    const t = await matched();
    await boostVibe(t);
    await t.mutation(api.games.dealCard, {
      ...auth("a"),
      cardId: CARD,
      mode: "guess",
    });
    await t.mutation(api.games.answerCard, {
      ...auth("a"),
      cardId: CARD,
      pick: "A",
    });
    await t.mutation(api.games.answerCard, {
      ...auth("b"),
      cardId: CARD,
      pick: "B",
    });
    const b = await t.query(api.chat.snapshot, auth("b"));
    expect(b.guessTally).toEqual({ rounds: 1, correct: 0 });
  });

  it("the completion row carries mode and viewer-relative dealtBy", async () => {
    const t = await matched();
    await boostVibe(t);
    await t.mutation(api.games.dealCard, {
      ...auth("a"),
      cardId: CARD,
      mode: "guess",
    });
    for (const id of ["a", "b"]) {
      await t.mutation(api.games.answerCard, {
        ...auth(id),
        cardId: CARD,
        pick: "A",
      });
    }
    const aRow = (await t.query(api.chat.messages, auth("a"))).at(-1);
    expect(aRow?.gameResult?.mode).toBe("guess");
    expect(aRow?.gameResult?.dealtBy).toBe("self");
    const bRow = (await t.query(api.chat.messages, auth("b"))).at(-1);
    expect(bRow?.gameResult?.dealtBy).toBe("partner");
  });
});

describe("game streak", () => {
  async function playRound(
    t: Awaited<ReturnType<typeof matched>>,
    cardId: string,
    bPick: "A" | "B",
    mode?: "guess",
  ) {
    await t.mutation(api.games.dealCard, {
      ...auth("a"),
      cardId,
      ...(mode ? { mode } : {}),
    });
    await t.mutation(api.games.answerCard, { ...auth("a"), cardId, pick: "A" });
    await t.mutation(api.games.answerCard, {
      ...auth("b"),
      cardId,
      pick: bPick,
    });
  }

  it("successes extend it; a miss resets current but keeps best", async () => {
    const t = await matched();
    const cards = GAME_DECKS["this-or-that"];
    await playRound(t, cards[0].id, "A");
    await playRound(t, cards[1].id, "A");
    let s = await t.query(api.chat.snapshot, auth("a"));
    expect(s.gameStreak).toEqual({ current: 2, best: 2 });
    await playRound(t, cards[2].id, "B");
    s = await t.query(api.chat.snapshot, auth("a"));
    expect(s.gameStreak).toEqual({ current: 0, best: 2 });
  });

  it("a correct guess extends the same streak as a match", async () => {
    const t = await matched();
    await boostVibe(t);
    const cards = GAME_DECKS["this-or-that"];
    await playRound(t, cards[0].id, "A");
    await playRound(t, cards[1].id, "A", "guess");
    const s = await t.query(api.chat.snapshot, auth("b"));
    expect(s.gameStreak).toEqual({ current: 2, best: 2 });
  });

  it("re-deals and dismissals never touch it", async () => {
    const t = await matched();
    const cards = GAME_DECKS["this-or-that"];
    await playRound(t, cards[0].id, "A");
    // An abandoned round (answered once, then replaced, then dismissed).
    await t.mutation(api.games.dealCard, { ...auth("a"), cardId: cards[1].id });
    await t.mutation(api.games.answerCard, {
      ...auth("a"),
      cardId: cards[1].id,
      pick: "A",
    });
    await t.mutation(api.games.dealCard, { ...auth("b"), cardId: cards[2].id });
    await t.mutation(api.games.dismissGame, auth("a"));
    const s = await t.query(api.chat.snapshot, auth("a"));
    expect(s.gameStreak).toEqual({ current: 1, best: 1 });
  });
});
