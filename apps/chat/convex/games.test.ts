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

describe("games", () => {
  it("deal shows the round to both players, viewer-relative", async () => {
    const t = await matched();
    await t.mutation(api.games.dealCard, { ...auth("a"), cardId: CARD });
    const a = await t.query(api.chat.snapshot, auth("a"));
    expect(a.game).toEqual({
      cardId: CARD,
      dealtBy: "self",
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
    });
    const bMsgs = await t.query(api.chat.messages, auth("b"));
    expect(bMsgs.at(-1)?.gameResult).toEqual({
      cardId: CARD,
      selfPick: "B",
      partnerPick: "A",
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
