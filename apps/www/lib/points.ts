import type { db } from "@umamin/db";
import { userBlockTable, userTable } from "@umamin/db/schema/user";
import { and, eq, sql } from "drizzle-orm";

// "Aura" point weights per engagement event — the single place to tune values.
// You earn when OTHERS engage with what you made/did (beneficiary = author /
// followed user). v1 is cosmetic: points accumulate, nothing unlocks yet.
export const AURA_POINTS = {
  like: 2,
  comment: 5,
  repost: 3,
  quote: 3,
  pollVote: 1,
  commentLike: 1,
  follow: 10,
} as const;

export type AuraEvent = keyof typeof AURA_POINTS;

// Engagement from accounts younger than this earns the beneficiary nothing —
// the cheapest defense against fresh throwaway-alt farming. One-line constant.
export const AURA_MIN_ACCOUNT_AGE_MS = 3 * 24 * 60 * 60 * 1000;

// Unknown age (no hydrated actor) is treated as ineligible — conservative
// against farming. In production a session always carries a user, so this only
// trips for non-hydrated test sessions.
export function isAuraEligibleActor(
  actorCreatedAt: Date | null | undefined,
  now = Date.now(),
): boolean {
  if (!actorCreatedAt) return false;
  return now - actorCreatedAt.getTime() >= AURA_MIN_ACCOUNT_AGE_MS;
}

type AuraTx = Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

type AwardArgs = {
  beneficiaryId: string;
  actorId: string;
  actorCreatedAt: Date | null | undefined;
  delta: number;
};

/**
 * Awards aura to the beneficiary inside the caller's transaction. Returns the
 * beneficiary's username (for `updateTag(\`user:${username}\`)`) ONLY when the
 * award actually lands, else null. No-ops when:
 *  - self-interaction (beneficiary === actor),
 *  - the actor's account is younger than the age gate, or
 *  - a block exists in EITHER direction — checked inline via NOT EXISTS so the
 *    award stays a single write with no extra read round-trip.
 * The username comes free from RETURNING on the points update (the row updated
 * IS the beneficiary's user row), so this costs +1 PK write and 0 extra reads.
 */
export async function awardAura(
  tx: AuraTx,
  { beneficiaryId, actorId, actorCreatedAt, delta }: AwardArgs,
): Promise<string | null> {
  if (delta <= 0) return null;
  if (beneficiaryId === actorId) return null;
  if (!isAuraEligibleActor(actorCreatedAt)) return null;

  const rows = await tx
    .update(userTable)
    .set({ points: sql`${userTable.points} + ${delta}` })
    .where(
      and(
        eq(userTable.id, beneficiaryId),
        sql`NOT EXISTS (
          SELECT 1 FROM ${userBlockTable}
          WHERE (${userBlockTable.blockerId} = ${actorId} AND ${userBlockTable.blockedId} = ${beneficiaryId})
             OR (${userBlockTable.blockerId} = ${beneficiaryId} AND ${userBlockTable.blockedId} = ${actorId})
        )`,
      ),
    )
    .returning({ username: userTable.username });

  return rows[0]?.username ?? null;
}

type ReverseArgs = {
  beneficiaryId: string;
  actorId: string;
  actorCreatedAt: Date | null | undefined;
  delta: number;
};

/**
 * Reverses an earlier award (un-like, un-repost, un-follow, comment/quote
 * delete). Clamped at 0 so aura can never go negative. Mirrors awardAura's
 * self-guard + age-gate: a consistently under-age OR consistently eligible
 * actor's like→unlike nets exactly zero for the beneficiary. The age gate is
 * live, so an account that crosses the 3-day boundary BETWEEN award and reverse
 * can drain a small bounded amount it never granted (clamped at 0) — accepted
 * cosmetic v1 drift, fully resolved only by the deferred per-event ledger.
 * Dropping the gate here is NOT the fix: it would make the common fresh-account
 * fresh→unfollow path drain points that were never awarded. Deliberately does
 * NOT re-check blocks: if an award landed before a block, its reversal must
 * still subtract. Returns the beneficiary username when a row changed, else null.
 */
export async function reverseAura(
  tx: AuraTx,
  { beneficiaryId, actorId, actorCreatedAt, delta }: ReverseArgs,
): Promise<string | null> {
  if (delta <= 0) return null;
  if (beneficiaryId === actorId) return null;
  if (!isAuraEligibleActor(actorCreatedAt)) return null;

  const rows = await tx
    .update(userTable)
    .set({
      points: sql`CASE WHEN ${userTable.points} >= ${delta} THEN ${userTable.points} - ${delta} ELSE 0 END`,
    })
    .where(eq(userTable.id, beneficiaryId))
    .returning({ username: userTable.username });

  return rows[0]?.username ?? null;
}
