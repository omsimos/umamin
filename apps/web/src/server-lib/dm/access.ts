import { dmThreadTable } from "@umamin/db/schema/dm";
import {
  userBlockTable,
  userFollowTable,
  userTable,
} from "@umamin/db/schema/user";
import { sql } from "drizzle-orm";
import type { DmPeerResponse } from "../../lib/dm/types";
import type { Db } from "../db";

export type DmPeerAccess = DmPeerResponse & { blocked: boolean };

type Row = {
  id: string;
  username: string;
  display_name: string | null;
  image_url: string | null;
  follows: number;
  blocks: number;
  has_thread: number;
};

/**
 * Resolves who the viewer wants to message and whether they may, in one round
 * trip: the user row, both follow edges, a block either way and whether a
 * conversation already exists. Null for an unknown, banned or own username.
 */
export async function resolveDmPeer(
  db: Db,
  viewerId: string,
  username: string,
): Promise<DmPeerAccess | null> {
  const rows = await db.all<Row>(sql`
    SELECT u.id, u.username, u.display_name, u.image_url,
      (SELECT COUNT(*) FROM ${userFollowTable}
        WHERE (${userFollowTable.followerId} = ${viewerId} AND ${userFollowTable.followingId} = u.id)
           OR (${userFollowTable.followerId} = u.id AND ${userFollowTable.followingId} = ${viewerId})) AS follows,
      (SELECT COUNT(*) FROM ${userBlockTable}
        WHERE (${userBlockTable.blockerId} = ${viewerId} AND ${userBlockTable.blockedId} = u.id)
           OR (${userBlockTable.blockerId} = u.id AND ${userBlockTable.blockedId} = ${viewerId})) AS blocks,
      EXISTS (SELECT 1 FROM ${dmThreadTable} WHERE ${dmThreadTable.id} =
        CASE WHEN ${viewerId} < u.id THEN ${viewerId} || ':' || u.id
             ELSE u.id || ':' || ${viewerId} END) AS has_thread
    FROM ${userTable} u
    WHERE u.username = ${username} AND u.banned_at IS NULL
    LIMIT 1
  `);
  const row = rows[0];
  if (!row || row.id === viewerId) return null;
  const blocked = Number(row.blocks) > 0;
  return {
    peer: {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      imageUrl: row.image_url,
    },
    canMessage: !blocked && Number(row.follows) === 2,
    hasThread: !blocked && Number(row.has_thread) === 1,
    blocked,
  };
}
