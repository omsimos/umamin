import { moderationDisputeTable } from "@umamin/db/schema/moderation-dispute";
import { noteTable } from "@umamin/db/schema/note";
import { postCommentTable, postTable } from "@umamin/db/schema/post";
import { userTable } from "@umamin/db/schema/user";
import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  type SQLWrapper,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type {
  FeedAuthor,
  ReviewItem,
  ReviewKind,
  ReviewPage,
} from "../lib/types";
import { contentLabel } from "./content-label";
import { parseCursor } from "./cursor";
import { feedAuthorColumns } from "./data";
import type { Db } from "./db";

// Moderator-only queue over the classifier's output. Private messages never
// appear here: the receiver opted into their own filter, and moderators don't
// read inboxes.

const PAGE_SIZE = 20;
// Shadow-mode drama tuning reads only the newest rows per table: bounded by
// the existing created_at indexes instead of a new one.
const DRAMA_WINDOW = 200;
const DRAMA_FLOOR = 50;

const scoreFields = <
  T extends typeof postTable | typeof postCommentTable | typeof noteTable,
>(
  table: T,
) => ({
  severe: table.modSevere,
  drama: table.modDrama,
  reason: table.modReason,
  flaggedAt: table.modFlaggedAt,
  clearedAt: table.modClearedAt,
  appealedAt: table.modAppealedAt,
});

const quotedPost = alias(postTable, "quoted_post");
const parentPost = alias(postTable, "parent_post");

/**
 * Flagged content no moderator has decided on yet, newest flag first, across
 * all three tables. A row is flagged by a high severe score, its author's
 * appeal, or a viewer's dispute.
 */
export async function getSevereReviewPage(
  db: Db,
  cursor: string | null,
  enforce: boolean,
): Promise<ReviewPage> {
  const parsed = parseCursor(cursor);
  const after = <
    T extends typeof postTable | typeof postCommentTable | typeof noteTable,
  >(
    table: T,
  ) =>
    parsed
      ? or(
          lt(table.modFlaggedAt, parsed.cursorDate),
          and(
            eq(table.modFlaggedAt, parsed.cursorDate),
            lt(table.id, parsed.cursorId),
          ),
        )
      : undefined;
  const flagged = <
    T extends typeof postTable | typeof postCommentTable | typeof noteTable,
  >(
    table: T,
  ) =>
    and(
      isNotNull(table.modFlaggedAt),
      isNull(table.modClearedAt),
      isNull(table.modReviewedAt),
      after(table),
    );

  const [posts, comments, notes] = await Promise.all([
    db
      .select({
        id: postTable.id,
        content: postTable.content,
        createdAt: postTable.createdAt,
        context: quotedPost.content,
        ...scoreFields(postTable),
        author: feedAuthorColumns,
      })
      .from(postTable)
      .innerJoin(userTable, eq(postTable.authorId, userTable.id))
      .leftJoin(quotedPost, eq(postTable.quotedPostId, quotedPost.id))
      .where(flagged(postTable))
      .orderBy(desc(postTable.modFlaggedAt), desc(postTable.id))
      .limit(PAGE_SIZE + 1),
    db
      .select({
        id: postCommentTable.id,
        content: postCommentTable.content,
        createdAt: postCommentTable.createdAt,
        postId: postCommentTable.postId,
        context: parentPost.content,
        ...scoreFields(postCommentTable),
        author: feedAuthorColumns,
      })
      .from(postCommentTable)
      .innerJoin(userTable, eq(postCommentTable.authorId, userTable.id))
      .leftJoin(parentPost, eq(postCommentTable.postId, parentPost.id))
      .where(flagged(postCommentTable))
      .orderBy(desc(postCommentTable.modFlaggedAt), desc(postCommentTable.id))
      .limit(PAGE_SIZE + 1),
    db
      .select({
        id: noteTable.id,
        content: noteTable.content,
        createdAt: noteTable.createdAt,
        isAnonymous: noteTable.isAnonymous,
        ...scoreFields(noteTable),
        author: feedAuthorColumns,
      })
      .from(noteTable)
      .innerJoin(userTable, eq(noteTable.userId, userTable.id))
      .where(flagged(noteTable))
      .orderBy(desc(noteTable.modFlaggedAt), desc(noteTable.id))
      .limit(PAGE_SIZE + 1),
  ]);

  const merged = mergeNewest(
    [
      ...posts.map((row) => toItem("post", row, enforce)),
      ...comments.map((row) => toItem("comment", row, enforce)),
      ...notes.map((row) => toItem("note", row, enforce)),
    ],
    (item) => item.flaggedAt,
  );
  const page = await withDisputeCounts(db, merged.slice(0, PAGE_SIZE));
  const last = page[page.length - 1];

  return {
    data: page,
    nextCursor:
      merged.length > PAGE_SIZE && last?.flaggedAt
        ? `${last.flaggedAt.getTime()}.${last.id}`
        : null,
  };
}

/** Recent content scoring as possible drama, for checking the threshold. */
export async function getDramaReviewPage(
  db: Db,
  enforce: boolean,
): Promise<ReviewPage> {
  // Newest rows first, filtered here rather than in SQL: a WHERE on mod_drama
  // with no index to serve it could walk the whole table when matches are
  // rare, and Turso bills every row scanned.
  const [posts, comments, notes] = await Promise.all([
    db
      .select({
        id: postTable.id,
        content: postTable.content,
        createdAt: postTable.createdAt,
        ...scoreFields(postTable),
        author: feedAuthorColumns,
      })
      .from(postTable)
      .innerJoin(userTable, eq(postTable.authorId, userTable.id))
      .orderBy(desc(postTable.createdAt), desc(postTable.id))
      .limit(DRAMA_WINDOW),
    db
      .select({
        id: postCommentTable.id,
        content: postCommentTable.content,
        createdAt: postCommentTable.createdAt,
        postId: postCommentTable.postId,
        ...scoreFields(postCommentTable),
        author: feedAuthorColumns,
      })
      .from(postCommentTable)
      .innerJoin(userTable, eq(postCommentTable.authorId, userTable.id))
      // post_comment has no created_at index; the newest rows by rowid
      // (insertion order) are a primary-key walk instead of a full sort.
      .orderBy(desc(sql`${postCommentTable}.rowid`))
      .limit(DRAMA_WINDOW),
    db
      .select({
        id: noteTable.id,
        content: noteTable.content,
        createdAt: noteTable.createdAt,
        isAnonymous: noteTable.isAnonymous,
        ...scoreFields(noteTable),
        author: feedAuthorColumns,
      })
      .from(noteTable)
      .innerJoin(userTable, eq(noteTable.userId, userTable.id))
      .orderBy(desc(noteTable.updatedAt), desc(noteTable.id))
      .limit(DRAMA_WINDOW),
  ]);

  const isCandidate = (row: { drama: number | null; clearedAt: Date | null }) =>
    (row.drama ?? 0) >= DRAMA_FLOOR && !row.clearedAt;

  const merged = mergeNewest(
    [
      ...posts.filter(isCandidate).map((row) => toItem("post", row, enforce)),
      ...comments
        .filter(isCandidate)
        .map((row) => toItem("comment", row, enforce)),
      ...notes.filter(isCandidate).map((row) => toItem("note", row, enforce)),
    ],
    (item) => item.createdAt,
  );
  return { data: merged.slice(0, 50), nextCursor: null };
}

function toItem(
  kind: ReviewKind,
  row: {
    id: string;
    content: string;
    createdAt: Date;
    postId?: string;
    context?: string | null;
    isAnonymous?: boolean;
    severe: number | null;
    drama: number | null;
    reason: string | null;
    flaggedAt: Date | null;
    clearedAt: Date | null;
    appealedAt: Date | null;
    author: FeedAuthor;
  },
  enforce: boolean,
): ReviewItem {
  return {
    kind,
    id: row.id,
    content: row.content,
    author: row.isAnonymous ? null : row.author,
    postId: row.postId ?? null,
    context: row.context ?? null,
    createdAt: row.createdAt,
    flaggedAt: row.flaggedAt,
    severe: row.severe,
    drama: row.drama,
    reason: row.reason,
    label: contentLabel(
      {
        modSevere: row.severe,
        modDrama: row.drama,
        modReason: row.reason,
        modClearedAt: row.clearedAt,
      },
      enforce,
    ),
    appealed: !!row.appealedAt,
    disputes: 0,
  };
}

// A dispute's target_id is a soft reference, so every path that deletes a post,
// comment or note must delete its disputes too. `target` is one id, or a
// subquery of ids (the comments a post delete is about to cascade away).
export function deleteDisputes(
  tx: Pick<Db, "delete">,
  kind: ReviewKind,
  target: string | SQLWrapper,
) {
  return tx
    .delete(moderationDisputeTable)
    .where(
      and(
        eq(moderationDisputeTable.kind, kind),
        typeof target === "string"
          ? eq(moderationDisputeTable.targetId, target)
          : inArray(moderationDisputeTable.targetId, target),
      ),
    );
}

// One grouped read over the page's ids (bounded by PAGE_SIZE).
async function withDisputeCounts(
  db: Db,
  items: ReviewItem[],
): Promise<ReviewItem[]> {
  if (items.length === 0) return items;
  const rows = await db
    .select({
      kind: moderationDisputeTable.kind,
      targetId: moderationDisputeTable.targetId,
      disputes: count(),
    })
    .from(moderationDisputeTable)
    .where(
      or(
        ...(["post", "comment", "note"] as const).map((kind) => {
          const ids = items
            .filter((item) => item.kind === kind)
            .map((item) => item.id);
          return ids.length
            ? and(
                eq(moderationDisputeTable.kind, kind),
                inArray(moderationDisputeTable.targetId, ids),
              )
            : undefined;
        }),
      ),
    )
    .groupBy(moderationDisputeTable.kind, moderationDisputeTable.targetId);
  const counts = new Map(
    rows.map((row) => [`${row.kind}:${row.targetId}`, row.disputes]),
  );
  return items.map((item) => ({
    ...item,
    disputes: counts.get(`${item.kind}:${item.id}`) ?? 0,
  }));
}

function mergeNewest(
  items: ReviewItem[],
  key: (item: ReviewItem) => Date | null,
): ReviewItem[] {
  return items.sort((a, b) => {
    const diff = (key(b)?.getTime() ?? 0) - (key(a)?.getTime() ?? 0);
    return diff !== 0 ? diff : b.id < a.id ? -1 : b.id > a.id ? 1 : 0;
  });
}
