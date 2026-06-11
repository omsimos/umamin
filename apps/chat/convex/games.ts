import { ConvexError, v } from "convex/values";
import { activeMatchFor } from "./chat";
import { cardById } from "./decks";
import { limitGlobal, limitPerSession } from "./lib/rateLimits";
import { sessionMutation } from "./lib/sessions";

export const dealCard = sessionMutation({
  args: { cardId: v.string() },
  handler: async (ctx, { cardId }) => {
    if (!cardById(cardId)) throw new ConvexError("Unknown card.");
    const match = await activeMatchFor(ctx, ctx.session);
    if (!match) return;
    await limitGlobal(ctx, "globalGameDeal");
    await limitPerSession(ctx, "gameDeal", ctx.sessionId);
    // Dealing ALWAYS replaces the current round (answered or not) — discarded
    // rounds never reach the tally, and this is the escape hatch when a
    // partner never answers.
    await ctx.db.patch(match._id, {
      game: { cardId, dealtBy: ctx.sessionId, dealtAt: Date.now() },
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
    const tally = match.gameTally ?? { rounds: 0, matched: 0 };
    if (game.answerA && game.answerB) {
      await ctx.db.patch(match._id, {
        game,
        gameTally: {
          rounds: tally.rounds + 1,
          matched: tally.matched + (game.answerA === game.answerB ? 1 : 0),
        },
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
