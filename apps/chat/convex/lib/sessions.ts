import { v } from "convex/values";
import {
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";

const sessionArgs = { sessionId: v.string() };

// Look up the (nullable) session row for a client-generated sessionId and
// attach { sessionId, session } to ctx. Creation happens explicitly in
// enqueueAndMatch — queries can't write, so the row may be null here.
async function lookupSession(ctx: QueryCtx | MutationCtx, sessionId: string) {
  return ctx.db
    .query("sessions")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .unique();
}

export const sessionQuery = customQuery(query, {
  args: sessionArgs,
  input: async (ctx, { sessionId }) => {
    const session = await lookupSession(ctx, sessionId);
    return { ctx: { sessionId, session }, args: {} };
  },
});

export const sessionMutation = customMutation(mutation, {
  args: sessionArgs,
  input: async (ctx, { sessionId }) => {
    const session = await lookupSession(ctx, sessionId);
    return { ctx: { sessionId, session }, args: {} };
  },
});
