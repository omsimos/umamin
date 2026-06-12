import { ConvexError, v } from "convex/values";
import { activeMatchFor, matchVibe } from "./chat";
import { cardById, DECK_MIN_LEVEL, GUESS_MODE_MIN_LEVEL } from "./decks";
import { limitGlobal, limitPerSession } from "./lib/rateLimits";
import { sessionMutation } from "./lib/sessions";

export const dealCard = sessionMutation({
  args: {
    cardId: v.string(),
    mode: v.optional(v.union(v.literal("match"), v.literal("guess"))),
  },
  handler: async (ctx, { cardId, mode }) => {
    const card = cardById(cardId);
    if (!card) throw new ConvexError("Unknown card.");
    const match = await activeMatchFor(ctx, ctx.session);
    if (!match) return;
    // Unlock gates: the play sheet's dimmed tiles are UX only.
    const level = matchVibe(match).level;
    if (
      DECK_MIN_LEVEL[card.deck] > level ||
      (mode === "guess" && GUESS_MODE_MIN_LEVEL > level)
    ) {
      throw new ConvexError("Locked — keep the vibe going to unlock this.");
    }
    await limitGlobal(ctx, "globalGameDeal");
    await limitPerSession(ctx, "gameDeal", ctx.sessionId);
    // Dealing ALWAYS replaces the current round (answered or not) — discarded
    // rounds never reach the tally, and this is the escape hatch when a
    // partner never answers.
    await ctx.db.patch(match._id, {
      game: {
        cardId,
        dealtBy: ctx.sessionId,
        ...(mode === "guess" ? { mode } : {}),
        dealtAt: Date.now(),
      },
    });
  },
});

export const answerCard = sessionMutation({
  args: { cardId: v.string(), pick: v.union(v.literal("A"), v.literal("B")) },
  handler: async (ctx, { cardId, pick }) => {
    const match = await activeMatchFor(ctx, ctx.session);
    // Stale-round guard: the round was replaced between render and tap.
    if (!match?.game || match.game.cardId !== cardId) return;
    const field = match.a === ctx.sessionId ? "answerA" : "answerB";
    if (match.game[field]) return; // first answer wins
    await limitGlobal(ctx, "globalGameAnswer");
    await limitPerSession(ctx, "gameAnswer", ctx.sessionId);
    const game = { ...match.game, [field]: pick };
    if (game.answerA && game.answerB) {
      // Same expression for both modes: in "match" equal picks are a match,
      // in "guess" the prediction equalling the dealer's truth is a hit.
      const success = game.answerA === game.answerB;
      const streak = match.gameStreak ?? { current: 0, best: 0 };
      const tally = match.gameTally ?? { rounds: 0, matched: 0 };
      const guesses = match.guessTally ?? { rounds: 0, correct: 0 };
      await ctx.db.patch(match._id, {
        game,
        gameStreak: success
          ? {
              current: streak.current + 1,
              best: Math.max(streak.best, streak.current + 1),
            }
          : { current: 0, best: streak.best },
        ...(game.mode === "guess"
          ? {
              guessTally: {
                rounds: guesses.rounds + 1,
                correct: guesses.correct + (success ? 1 : 0),
              },
            }
          : {
              gameTally: {
                rounds: tally.rounds + 1,
                matched: tally.matched + (success ? 1 : 0),
              },
            }),
      });
      // The durable record: completed rounds live in the conversation, so
      // they scroll with history and die with the match. Inserted only at
      // completion — an unanswered partner can't read an early pick off it.
      await ctx.db.insert("messages", {
        matchId: match._id,
        author: ctx.sessionId,
        text: "",
        kind: "game",
        game: {
          cardId: game.cardId,
          pickA: game.answerA,
          pickB: game.answerB,
          ...(game.mode === "guess" ? { mode: game.mode } : {}),
          dealtBy: game.dealtBy,
        },
      });
    } else {
      await ctx.db.patch(match._id, { game });
    }
  },
});

export const dismissGame = sessionMutation({
  args: {},
  handler: async (ctx) => {
    const match = await activeMatchFor(ctx, ctx.session);
    if (!match?.game) return;
    // Shares the deal budget — dismissing is the same round-management action.
    await limitPerSession(ctx, "gameDeal", ctx.sessionId);
    await ctx.db.patch(match._id, { game: undefined });
  },
});
