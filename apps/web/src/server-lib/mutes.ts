import { userMuteTable } from "@umamin/db/schema/user";
import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "./db";

// Mute is one-way (muter → muted), unlike block. It only filters what the
// muter sees and never affects delivery, follows, or the muted user's view.

export const MAX_MUTES = 1000;

/** Which of `actorIds` the viewer has muted. One bounded read on the uidx. */
export async function getMutedIds(
  db: Db,
  viewerId: string,
  actorIds: string[],
): Promise<Set<string>> {
  if (actorIds.length === 0) return new Set();

  const rows = await db
    .select({ mutedId: userMuteTable.mutedId })
    .from(userMuteTable)
    .where(
      and(
        eq(userMuteTable.muterId, viewerId),
        inArray(userMuteTable.mutedId, actorIds),
      ),
    );

  return new Set(rows.map((row) => row.mutedId));
}
