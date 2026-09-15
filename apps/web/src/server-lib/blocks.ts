import { userBlockTable } from "@umamin/db/schema/user";
import { and, eq, or, type SQL, type SQLWrapper, sql } from "drizzle-orm";
import type { Db } from "./db";

// Block semantics are symmetric everywhere in the app (message.ts, user.ts,
// points.ts): a block in EITHER direction severs the pair.

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** `NOT EXISTS (...)` over user_block for the pair (a, b), either direction.
 *  Each side is a column reference (correlated) or a bound id. */
export function noBlockBetween(
  a: SQLWrapper | string,
  b: SQLWrapper | string,
): SQL {
  return sql`NOT EXISTS (
    SELECT 1 FROM ${userBlockTable}
    WHERE (${userBlockTable.blockerId} = ${a} AND ${userBlockTable.blockedId} = ${b})
       OR (${userBlockTable.blockerId} = ${b} AND ${userBlockTable.blockedId} = ${a})
  )`;
}

/** One bounded read: does a block exist between the two users, either way? */
export async function hasBlockBetween(
  db: Db | Tx,
  a: string,
  b: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: userBlockTable.id })
    .from(userBlockTable)
    .where(
      or(
        and(eq(userBlockTable.blockerId, a), eq(userBlockTable.blockedId, b)),
        and(eq(userBlockTable.blockerId, b), eq(userBlockTable.blockedId, a)),
      ),
    )
    .limit(1);

  return rows.length > 0;
}
