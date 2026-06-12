import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import {
  FALLBACK_MS,
  GRACE_MS,
  MAX_ALIAS_LEN,
  MAX_AVATAR_SEED_LEN,
  MAX_INTEREST_LEN,
  MAX_INTERESTS,
  MAX_INVITE_CODE_LEN,
  QUEUE_FRESH_MS,
  RECONCILE_MS,
} from "./constants";
import { limitGlobal, limitPerSession } from "./lib/rateLimits";
import { sessionMutation } from "./lib/sessions";

async function getSession(ctx: MutationCtx, sessionId: string) {
  return ctx.db
    .query("sessions")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .unique();
}

// Only claim queuers whose radar pinged recently: a closed or backgrounded tab
// can't establish match presence, so pairing with it just manufactures a
// "partner left". Stale rows are skipped, not deleted — pings (and thus
// matchability) resume if the tab comes back; the queue sweep handles true
// ghosts. Pre-field rows fall back to enqueuedAt and age out naturally.
function isFresh(row: Doc<"queue">, now: number): boolean {
  return (row.lastPingAt ?? row.enqueuedAt) > now - QUEUE_FRESH_MS;
}

function normalizeIdentity(args: {
  alias: string;
  avatarSeed: string;
  interests: string[];
}) {
  const alias = args.alias.trim() || "Anonymous";
  const avatarSeed = args.avatarSeed.trim();
  const interests = Array.from(
    new Set(args.interests.map((i) => i.trim()).filter(Boolean)),
  );
  if (
    alias.length > MAX_ALIAS_LEN ||
    avatarSeed.length === 0 ||
    avatarSeed.length > MAX_AVATAR_SEED_LEN ||
    interests.length > MAX_INTERESTS ||
    interests.some((i) => i.length > MAX_INTEREST_LEN)
  ) {
    throw new ConvexError("Invalid identity.");
  }
  return { alias, avatarSeed, interests };
}

function normalizeCode(code: string | undefined): string | undefined {
  const trimmed = code?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > MAX_INVITE_CODE_LEN) {
    throw new ConvexError("Invalid invite code.");
  }
  return trimmed;
}

async function pair(
  ctx: MutationCtx,
  aSessionId: string,
  bRow: Doc<"queue">,
  shared: string[],
): Promise<Id<"matches">> {
  await ctx.db.delete(bRow._id);
  const now = Date.now();
  const matchId = await ctx.db.insert("matches", {
    a: aSessionId,
    b: bRow.sessionId,
    interestsShared: shared,
    stayConnectedA: false,
    stayConnectedB: false,
    typingA: false,
    typingB: false,
    bothEverPresent: false,
    status: "active" as const,
    createdAt: now,
  });
  for (const sid of [aSessionId, bRow.sessionId]) {
    const s = await getSession(ctx, sid);
    if (s) await ctx.db.patch(s._id, { currentMatchId: matchId });
  }
  await ctx.scheduler.runAfter(RECONCILE_MS, internal.presence.reconcile, {
    matchId,
  });
  return matchId;
}

export const enqueueAndMatch = sessionMutation({
  args: {
    alias: v.string(),
    avatarSeed: v.string(),
    interests: v.array(v.string()),
    // The caller's own shareable code, stamped on their queue row.
    inviteCode: v.optional(v.string()),
    // A ?join= deep link's code — try to land on its owner directly.
    joinCode: v.optional(v.string()),
  },
  returns: v.object({ viaInvite: v.boolean() }),
  handler: async (ctx, args) => {
    // The lobby bounds these, but this mutation is publicly callable.
    const identity = normalizeIdentity(args);
    const inviteCode = normalizeCode(args.inviteCode);
    const joinCode = normalizeCode(args.joinCode);
    await limitGlobal(ctx, "globalFindMatch");
    await limitPerSession(ctx, "findMatch", ctx.sessionId);
    const now = Date.now();

    // End any still-active match before re-queueing so the partner gets a clean
    // partner-left and the old match becomes GC-eligible, rather than being
    // silently abandoned (orphaned active matches have no cron backstop).
    if (ctx.session?.currentMatchId) {
      const prev = await ctx.db.get(ctx.session.currentMatchId);
      if (prev && prev.status === "active") {
        await ctx.db.patch(prev._id, {
          status: "ended",
          endedReason: "partner-left",
          endedAt: now,
        });
        await ctx.scheduler.runAfter(GRACE_MS, internal.cleanup.deleteMatch, {
          matchId: prev._id,
        });
      }
    }

    if (ctx.session) {
      await ctx.db.patch(ctx.session._id, {
        sessionSecret: ctx.sessionSecret,
        alias: identity.alias,
        avatarSeed: identity.avatarSeed,
        interests: identity.interests,
        lastSeen: now,
        currentMatchId: undefined,
      });
    } else {
      await ctx.db.insert("sessions", {
        sessionId: ctx.sessionId,
        sessionSecret: ctx.sessionSecret,
        alias: identity.alias,
        avatarSeed: identity.avatarSeed,
        interests: identity.interests,
        lastSeen: now,
      });
    }

    const mine = await ctx.db
      .query("queue")
      .withIndex("by_session", (q) => q.eq("sessionId", ctx.sessionId))
      .unique();
    if (mine) await ctx.db.delete(mine._id);

    const overlap = (q: { interests: string[] }) =>
      q.interests.filter((i) => identity.interests.includes(i));

    // Direct invite claim: a deep-linked visitor lands on the link's owner if
    // they're waiting and fresh. Skips the interest filter — this is a direct
    // request, not discovery. Absent/stale/self falls through to the normal
    // flow: the visitor still converts into a regular match.
    if (joinCode) {
      const target = await ctx.db
        .query("queue")
        .withIndex("by_inviteCode", (q) => q.eq("inviteCode", joinCode))
        .first();
      if (
        target &&
        target.sessionId !== ctx.sessionId &&
        isFresh(target, now)
      ) {
        await pair(ctx, ctx.sessionId, target, overlap(target));
        return { viaInvite: true };
      }
    }

    // Interest-preferred claim over the oldest waiting (bounded — no full scan).
    const waiting = await ctx.db
      .query("queue")
      .withIndex("by_enqueuedAt")
      .order("asc")
      .take(50);
    const others = waiting.filter(
      (q) => q.sessionId !== ctx.sessionId && isFresh(q, now),
    );
    const partner = others.find((q) => overlap(q).length > 0);
    if (partner) {
      await pair(ctx, ctx.sessionId, partner, overlap(partner));
      return { viaInvite: false };
    }

    await ctx.db.insert("queue", {
      sessionId: ctx.sessionId,
      interests: identity.interests,
      enqueuedAt: now,
      lastPingAt: now,
      ...(inviteCode ? { inviteCode } : {}),
    });
    await ctx.scheduler.runAfter(FALLBACK_MS, internal.match.fallbackPair, {
      sessionId: ctx.sessionId,
    });
    return { viaInvite: false };
  },
});

export const fallbackPair = internalMutation({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const mine = await ctx.db
      .query("queue")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .unique();
    if (!mine) return; // already matched or gone
    const now = Date.now();
    const waiting = await ctx.db
      .query("queue")
      .withIndex("by_enqueuedAt")
      .order("asc")
      .take(50);
    const partner = waiting.find(
      (q) => q.sessionId !== sessionId && isFresh(q, now),
    );
    if (!partner) return; // still nobody — keep waiting
    await ctx.db.delete(mine._id);
    const shared = mine.interests.filter((i) => partner.interests.includes(i));
    await pair(ctx, sessionId, partner, shared);
  },
});

/** Queue-liveness ping from the matching radar. Refreshes the caller's row so
 *  it stays claimable; a row whose pings stop (closed/backgrounded tab) goes
 *  stale within QUEUE_FRESH_MS and is skipped by pairing until pings resume. */
export const stillWaiting = sessionMutation({
  args: {},
  handler: async (ctx) => {
    await limitGlobal(ctx, "globalQueuePing");
    await limitPerSession(ctx, "queuePing", ctx.sessionId);
    const row = await ctx.db
      .query("queue")
      .withIndex("by_session", (q) => q.eq("sessionId", ctx.sessionId))
      .unique();
    if (!row) return; // matched or swept — the radar learns via snapshot
    await ctx.db.patch(row._id, { lastPingAt: Date.now() });
  },
});
