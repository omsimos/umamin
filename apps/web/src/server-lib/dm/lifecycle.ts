import { dmPurgeTable, dmThreadTable } from "@umamin/db/schema/dm";
import { asc, eq, inArray, or } from "drizzle-orm";
import { dmPair, dmRoomName } from "../../lib/dm/pair";
import type { Db } from "../db";
import { getDb } from "../db";
import type { AppEnv } from "../env";
import { captureServerException } from "../posthog";

/** Rooms purged per cron run. Each is one DO request. */
const PURGE_BATCH = 50;
/** Rooms a ban closes at once; bounded like every list read. */
const BAN_SEVER_LIMIT = 500;

function roomStub(env: AppEnv, threadId: string) {
  return env.DM_ROOM.get(env.DM_ROOM.idFromName(dmRoomName(threadId)));
}

/** Tells the pair's room about a block or unfollow, so open sockets close or
 *  go read-only at once instead of at the next access recheck. A room that
 *  was never used has no storage and stays that way. Best effort: the
 *  recheck is the backstop, so a failure is reported, never thrown. */
export async function severDm(
  env: AppEnv,
  a: string,
  b: string,
  kind: "block" | "unfollow",
): Promise<void> {
  if (!env.DM_ROOM) return;
  try {
    await roomStub(env, dmPair(a, b).threadId).sever(kind);
  } catch (err) {
    captureServerException(env, undefined, err, {
      properties: { where: "dm-sever", kind },
    });
  }
}

/** A banned user's open conversations close now; their session is already
 *  gone, so they can't reopen one. */
export async function severAllDms(
  db: Db,
  env: AppEnv,
  userId: string,
): Promise<void> {
  if (!env.DM_ROOM) return;
  const rows = await db
    .select({ id: dmThreadTable.id })
    .from(dmThreadTable)
    .where(
      or(
        eq(dmThreadTable.userLowId, userId),
        eq(dmThreadTable.userHighId, userId),
      ),
    )
    .limit(BAN_SEVER_LIMIT);
  await Promise.allSettled(rows.map((r) => roomStub(env, r.id).sever("block")));
}

/** Password change: every session is gone, but open sockets aren't sessions.
 *  Closing them reconnectably makes each pass the route's session check
 *  again. */
export async function revokeDmSockets(
  db: Db,
  env: AppEnv,
  userId: string,
): Promise<void> {
  if (!env.DM_ROOM) return;
  const rows = await db
    .select({ id: dmThreadTable.id })
    .from(dmThreadTable)
    .where(
      or(
        eq(dmThreadTable.userLowId, userId),
        eq(dmThreadTable.userHighId, userId),
      ),
    )
    .limit(BAN_SEVER_LIMIT);
  await Promise.allSettled(rows.map((r) => roomStub(env, r.id).revoke(userId)));
}

/** Cron: wipes the rooms queued by account deletion. A room that fails stays
 *  queued for the next run. */
export async function drainDmPurge(env: AppEnv): Promise<number> {
  const db = getDb(env);
  const rows = await db
    .select({ threadId: dmPurgeTable.threadId })
    .from(dmPurgeTable)
    .orderBy(asc(dmPurgeTable.createdAt))
    .limit(PURGE_BATCH);
  const results = await Promise.allSettled(
    rows.map((r) => roomStub(env, r.threadId).purge()),
  );
  const done = rows
    .filter((_, i) => results[i]?.status === "fulfilled")
    .map((r) => r.threadId);
  if (done.length > 0) {
    await db.delete(dmPurgeTable).where(inArray(dmPurgeTable.threadId, done));
  }
  return done.length;
}
