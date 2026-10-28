import { dmReportTable, dmThreadTable } from "@umamin/db/schema/dm";
import {
  userBlockTable,
  userFollowTable,
  userTable,
} from "@umamin/db/schema/user";
import { aesEncrypt } from "@umamin/encryption";
import { sql } from "drizzle-orm";
import type { ThreadSnapshot } from "../../lib/dm/engine";
import { type DmPair, userAt } from "../../lib/dm/pair";
import type { DmReportReason, DmReportSnapshotEntry } from "../../lib/dm/types";
import type { Db } from "../db";
import { getDb } from "../db";
import type { AppEnv } from "../env";
import { getMutedIds } from "../mutes";
import { sendPushForNotification } from "../notification-push";

/**
 * Everything DmRoom needs from Turso, behind one interface so the workerd
 * tests (which can't run libSQL) can swap in a fake.
 */
export interface DmStore {
  /** Mutual follow and no block in either direction. */
  canMessage(pair: DmPair): Promise<boolean>;
  writeThread(pair: DmPair, snapshot: ThreadSnapshot): Promise<void>;
  /** False when this reporter already reported this message. */
  insertReport(input: {
    reporterId: string;
    reportedId: string;
    threadId: string;
    messageSeq: number;
    reason: DmReportReason;
    entries: DmReportSnapshotEntry[];
  }): Promise<boolean>;
  pushMessage(recipientId: string, senderId: string): Promise<void>;
}

/** One round trip: both follow edges (two unique-index seeks), the block
 *  check (two more) and that neither account is banned. */
export async function canMessage(
  db: Db,
  a: string,
  b: string,
): Promise<boolean> {
  const rows = await db.all<{
    follows: number;
    blocks: number;
    active: number;
  }>(sql`
    SELECT
      (SELECT COUNT(*) FROM ${userFollowTable}
        WHERE (${userFollowTable.followerId} = ${a} AND ${userFollowTable.followingId} = ${b})
           OR (${userFollowTable.followerId} = ${b} AND ${userFollowTable.followingId} = ${a})) AS follows,
      (SELECT COUNT(*) FROM ${userBlockTable}
        WHERE (${userBlockTable.blockerId} = ${a} AND ${userBlockTable.blockedId} = ${b})
           OR (${userBlockTable.blockerId} = ${b} AND ${userBlockTable.blockedId} = ${a})) AS blocks,
      (SELECT COUNT(*) FROM ${userTable}
        WHERE ${userTable.id} IN (${a}, ${b}) AND ${userTable.bannedAt} IS NULL) AS active
  `);
  const row = rows[0];
  return (
    !!row &&
    Number(row.follows) === 2 &&
    Number(row.blocks) === 0 &&
    Number(row.active) === 2
  );
}

export function tursoDmStore(
  env: AppEnv,
  makeDb: () => Db = () => getDb(env),
): DmStore {
  let db: Db | null = null;
  const conn = () => {
    db ??= makeDb();
    return db;
  };

  return {
    canMessage: (pair) => canMessage(conn(), pair.lowId, pair.highId),

    async writeThread(pair, s) {
      const values = {
        lastMessageAt: new Date(s.lastAt),
        lastSeq: s.lastSeq,
        lastSenderId: s.lastSender === null ? null : userAt(pair, s.lastSender),
        lastPreview: s.preview === null ? null : await aesEncrypt(s.preview),
        lowReadSeq: s.readSeq[0],
        highReadSeq: s.readSeq[1],
        lowHiddenSeq: s.hiddenSeq[0],
        highHiddenSeq: s.hiddenSeq[1],
      };
      await conn()
        .insert(dmThreadTable)
        .values({
          id: pair.threadId,
          userLowId: pair.lowId,
          userHighId: pair.highId,
          ...values,
        })
        .onConflictDoUpdate({ target: dmThreadTable.id, set: values });
    },

    async insertReport(input) {
      const rows = await conn()
        .insert(dmReportTable)
        .values({
          reporterId: input.reporterId,
          reportedId: input.reportedId,
          threadId: input.threadId,
          messageSeq: input.messageSeq,
          reason: input.reason,
          snapshot: await aesEncrypt(JSON.stringify(input.entries)),
        })
        .onConflictDoNothing()
        .returning({ id: dmReportTable.id });
      return rows.length > 0;
    },

    // A mute silences the sender's pushes, like it does for notify().
    async pushMessage(recipientId, senderId) {
      const muted = await getMutedIds(conn(), recipientId, [senderId]);
      if (muted.size > 0) return;
      await sendPushForNotification(conn(), env, {
        recipientId,
        type: "dm",
        actorId: senderId,
      });
    },
  };
}
