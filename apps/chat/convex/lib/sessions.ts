import { ConvexError, v } from "convex/values";
import {
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import { MAX_SESSION_ID_LEN, MAX_SESSION_SECRET_LEN } from "../constants";

const sessionArgs = { sessionId: v.string(), sessionSecret: v.string() };

// Creation happens explicitly in enqueueAndMatch — queries can't write, so the
// row may be null here.
async function lookupSession(ctx: QueryCtx | MutationCtx, sessionId: string) {
  return ctx.db
    .query("sessions")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .unique();
}

function validateCredentials(sessionId: string, sessionSecret: string) {
  if (
    sessionId.length === 0 ||
    sessionId.length > MAX_SESSION_ID_LEN ||
    sessionSecret.length === 0 ||
    sessionSecret.length > MAX_SESSION_SECRET_LEN
  ) {
    throw new ConvexError({ kind: "Unauthorized" });
  }
}

export const sessionQuery = customQuery(query, {
  args: sessionArgs,
  input: async (ctx, { sessionId, sessionSecret }) => {
    validateCredentials(sessionId, sessionSecret);
    const session = await lookupSession(ctx, sessionId);
    if (session && session.sessionSecret !== sessionSecret) {
      throw new ConvexError({ kind: "Unauthorized" });
    }
    return { ctx: { sessionId, sessionSecret, session }, args: {} };
  },
});

export const sessionMutation = customMutation(mutation, {
  args: sessionArgs,
  input: async (ctx, { sessionId, sessionSecret }) => {
    validateCredentials(sessionId, sessionSecret);
    const session = await lookupSession(ctx, sessionId);
    if (session && session.sessionSecret !== sessionSecret) {
      throw new ConvexError({ kind: "Unauthorized" });
    }
    return { ctx: { sessionId, sessionSecret, session }, args: {} };
  },
});
