/** Stay-connected reveal: after BOTH sides tap the heart, each may submit a
 *  handle that is shown to the partner only once both have submitted — the
 *  same anti-leak gate as game picks. The handle is the app's one deliberate
 *  PII exception: NEVER log it, NEVER echo it in an error message, and never
 *  put it on a shareable artifact. It lives on the match row and is gone
 *  forever when deleteMatch removes the row. */

import { ConvexError, v } from "convex/values";
import { activeMatchFor } from "./chat";
import { MAX_REVEAL_HANDLE_LEN } from "./constants";
import { limitGlobal, limitPerSession } from "./lib/rateLimits";
import { sessionMutation } from "./lib/sessions";

export const submitReveal = sessionMutation({
  args: { handle: v.string() },
  handler: async (ctx, { handle }) => {
    const trimmed = handle.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_REVEAL_HANDLE_LEN) {
      throw new ConvexError("Handle is too long.");
    }
    const match = await activeMatchFor(ctx, ctx.session);
    // Ended match → no-op: a handle can never be written after the end.
    if (!match) return;
    // Mutual hearts is the only gate — already a deliberate two-sided action;
    // the vibe meter spotlights the reveal but never gates it.
    if (!(match.stayConnectedA && match.stayConnectedB)) {
      throw new ConvexError("Not unlocked yet.");
    }
    // No edits after the mutual reveal — prevents a bait-and-switch once the
    // partner's handle has been seen. Before that, resubmitting replaces.
    if (match.revealA && match.revealB) return;
    await limitGlobal(ctx, "globalReveal");
    await limitPerSession(ctx, "revealSubmit", ctx.sessionId);
    await ctx.db.patch(
      match._id,
      match.a === ctx.sessionId ? { revealA: trimmed } : { revealB: trimmed },
    );
  },
});

export const withdrawReveal = sessionMutation({
  args: {},
  handler: async (ctx) => {
    const match = await activeMatchFor(ctx, ctx.session);
    if (!match) return;
    // Locked once mutually revealed, same as submit.
    if (match.revealA && match.revealB) return;
    // Nothing to withdraw → no write, no snapshot invalidation for either side.
    const field =
      match.a === ctx.sessionId ? ("revealA" as const) : ("revealB" as const);
    if (!match[field]) return;
    await limitGlobal(ctx, "globalReveal");
    // Shares the submit budget — withdrawing is the same deliberate action.
    await limitPerSession(ctx, "revealSubmit", ctx.sessionId);
    await ctx.db.patch(match._id, { [field]: undefined });
  },
});
