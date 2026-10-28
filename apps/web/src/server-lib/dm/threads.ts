import {
  type DmReportResolution,
  dmPurgeTable,
  dmReportTable,
  dmThreadTable,
} from "@umamin/db/schema/dm";
import { userTable } from "@umamin/db/schema/user";
import { aesDecrypt } from "@umamin/encryption";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  isNull,
  lt,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { DM_THREADS_PAGE_SIZE } from "../../lib/dm/constants";
import type {
  DmReportItem,
  DmReportSnapshotEntry,
  DmThreadItem,
  DmThreadsResponse,
} from "../../lib/dm/types";
import { noBlockBetween } from "../blocks";
import type { Db } from "../db";

/** How far back the unread count looks per side. Bounds the rows scanned for
 *  a user with many old conversations. */
const UNREAD_SCAN_WINDOW = 50;

type Side = "low" | "high";

const COLS = {
  low: {
    me: dmThreadTable.userLowId,
    peer: dmThreadTable.userHighId,
    read: dmThreadTable.lowReadSeq,
    hidden: dmThreadTable.lowHiddenSeq,
  },
  high: {
    me: dmThreadTable.userHighId,
    peer: dmThreadTable.userLowId,
    read: dmThreadTable.highReadSeq,
    hidden: dmThreadTable.highHiddenSeq,
  },
} as const;

function parseCursor(cursor: string | null): { at: Date; id: string } | null {
  if (!cursor) return null;
  const dot = cursor.indexOf(".");
  const ms = Number(cursor.slice(0, dot));
  const id = cursor.slice(dot + 1);
  if (dot < 1 || !Number.isFinite(ms) || !id) return null;
  return { at: new Date(ms), id };
}

/** One side's page: an index seek on (user_*_id, last_message_at). */
function sidePage(
  db: Db,
  viewerId: string,
  side: Side,
  cursor: SQL | undefined,
) {
  const c = COLS[side];
  return db
    .select({
      threadId: dmThreadTable.id,
      lastMessageAt: dmThreadTable.lastMessageAt,
      lastSeq: dmThreadTable.lastSeq,
      lastSenderId: dmThreadTable.lastSenderId,
      lastPreview: dmThreadTable.lastPreview,
      readSeq: c.read,
      peerId: userTable.id,
      username: userTable.username,
      displayName: userTable.displayName,
      imageUrl: userTable.imageUrl,
    })
    .from(dmThreadTable)
    .innerJoin(userTable, eq(userTable.id, c.peer))
    .where(
      and(
        eq(c.me, viewerId),
        gt(dmThreadTable.lastSeq, c.hidden),
        isNull(userTable.bannedAt),
        noBlockBetween(viewerId, c.peer),
        cursor,
      ),
    )
    .orderBy(desc(dmThreadTable.lastMessageAt), desc(dmThreadTable.id))
    .limit(DM_THREADS_PAGE_SIZE + 1);
}

/** The Chats list, newest first: two bounded seeks merged in code. */
export async function getDmThreadsPage(
  db: Db,
  viewerId: string,
  cursorRaw: string | null,
): Promise<DmThreadsResponse> {
  const cursor = parseCursor(cursorRaw);
  const before = cursor
    ? or(
        lt(dmThreadTable.lastMessageAt, cursor.at),
        and(
          eq(dmThreadTable.lastMessageAt, cursor.at),
          lt(dmThreadTable.id, cursor.id),
        ),
      )
    : undefined;

  const [low, high] = await Promise.all([
    sidePage(db, viewerId, "low", before),
    sidePage(db, viewerId, "high", before),
  ]);
  const merged = [...low, ...high].sort(
    (x, y) =>
      y.lastMessageAt.getTime() - x.lastMessageAt.getTime() ||
      (y.threadId < x.threadId ? -1 : 1),
  );
  const page = merged.slice(0, DM_THREADS_PAGE_SIZE);
  const last = page.at(-1);

  const data: DmThreadItem[] = await Promise.all(
    page.map(async (r) => ({
      threadId: r.threadId,
      peer: {
        id: r.peerId,
        username: r.username,
        displayName: r.displayName,
        imageUrl: r.imageUrl,
      },
      preview: r.lastPreview ? await aesDecrypt(r.lastPreview) : null,
      lastFromMe: r.lastSenderId === viewerId,
      lastMessageAt: r.lastMessageAt.getTime(),
      unread: r.lastSenderId === r.peerId && r.lastSeq > r.readSeq,
    })),
  );

  return {
    data,
    nextCursor:
      merged.length > DM_THREADS_PAGE_SIZE && last
        ? `${last.lastMessageAt.getTime()}.${last.threadId}`
        : null,
  };
}

/**
 * Conversations with an unread message from the other side, capped at
 * DM_THREADS_PAGE_SIZE + 1. Each side reads at most UNREAD_SCAN_WINDOW of its
 * newest threads, so the badge never scans a user's whole history.
 */
export async function getDmUnreadCount(
  db: Db,
  viewerId: string,
): Promise<number> {
  const count = (side: Side) => {
    const c = COLS[side];
    const recent = db
      .select({
        lastSeq: dmThreadTable.lastSeq,
        lastSenderId: dmThreadTable.lastSenderId,
        readSeq: sql<number>`${c.read}`.as("read_seq"),
        hiddenSeq: sql<number>`${c.hidden}`.as("hidden_seq"),
        peerId: sql<string>`${c.peer}`.as("peer_id"),
      })
      .from(dmThreadTable)
      .innerJoin(userTable, eq(userTable.id, c.peer))
      .where(and(eq(c.me, viewerId), isNull(userTable.bannedAt)))
      .orderBy(desc(dmThreadTable.lastMessageAt))
      .limit(UNREAD_SCAN_WINDOW)
      .as("recent");
    return db
      .select({ n: sql<number>`COUNT(*)` })
      .from(recent)
      .where(
        and(
          sql`${recent.lastSenderId} = ${recent.peerId}`,
          sql`${recent.lastSeq} > ${recent.readSeq}`,
          sql`${recent.lastSeq} > ${recent.hiddenSeq}`,
          noBlockBetween(viewerId, recent.peerId),
        ),
      );
  };
  const [[low], [high]] = await Promise.all([count("low"), count("high")]);
  return Math.min(
    Number(low?.n ?? 0) + Number(high?.n ?? 0),
    DM_THREADS_PAGE_SIZE + 1,
  );
}

/** Copies the user's conversations into the purge queue. Runs inside the
 *  account-delete transaction, before the cascade removes the rows. */
export async function queueDmPurge(
  tx: Pick<Db, "insert" | "select">,
  userId: string,
): Promise<void> {
  await tx
    .insert(dmPurgeTable)
    .select(
      tx
        .select({
          threadId: dmThreadTable.id,
          createdAt: sql<Date>`(unixepoch())`.as("created_at"),
        })
        .from(dmThreadTable)
        .where(
          or(
            eq(dmThreadTable.userLowId, userId),
            eq(dmThreadTable.userHighId, userId),
          ),
        ),
    )
    .onConflictDoNothing();
}

// ── reports (moderator-only) ────────────────────────────────────────────────

const REPORTS_PAGE_SIZE = 20;

/** Open reports, oldest first, on the partial index. */
export async function getOpenDmReports(db: Db): Promise<DmReportItem[]> {
  const reporter = alias(userTable, "reporter");
  const reported = alias(userTable, "reported");
  const rows = await db
    .select({
      id: dmReportTable.id,
      reason: dmReportTable.reason,
      createdAt: dmReportTable.createdAt,
      messageSeq: dmReportTable.messageSeq,
      snapshot: dmReportTable.snapshot,
      reporterId: reporter.id,
      reporterUsername: reporter.username,
      reportedId: reported.id,
      reportedUsername: reported.username,
    })
    .from(dmReportTable)
    .leftJoin(reporter, eq(reporter.id, dmReportTable.reporterId))
    .leftJoin(reported, eq(reported.id, dmReportTable.reportedId))
    .where(isNull(dmReportTable.resolvedAt))
    .orderBy(asc(dmReportTable.createdAt))
    .limit(REPORTS_PAGE_SIZE);

  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      reason: r.reason,
      createdAt: r.createdAt.getTime(),
      messageSeq: r.messageSeq,
      reporter:
        r.reporterId && r.reporterUsername
          ? { id: r.reporterId, username: r.reporterUsername }
          : null,
      reported:
        r.reportedId && r.reportedUsername
          ? { id: r.reportedId, username: r.reportedUsername }
          : null,
      snapshot: JSON.parse(
        await aesDecrypt(r.snapshot),
      ) as DmReportSnapshotEntry[],
    })),
  );
}

/** Stamps an open report. False when it was already resolved or is gone. */
export async function resolveDmReport(
  db: Db,
  id: string,
  moderatorId: string,
  resolution: DmReportResolution,
): Promise<boolean> {
  const rows = await db
    .update(dmReportTable)
    .set({ resolvedAt: new Date(), resolvedById: moderatorId, resolution })
    .where(and(eq(dmReportTable.id, id), isNull(dmReportTable.resolvedAt)))
    .returning({ id: dmReportTable.id });
  return rows.length > 0;
}
