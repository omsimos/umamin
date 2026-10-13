import { noteTable } from "@umamin/db/schema/note";
import { postCommentTable, postTable } from "@umamin/db/schema/post";
import { userTable } from "@umamin/db/schema/user";
import { and, desc, eq, isNotNull, isNull, lt, or } from "drizzle-orm";
import type {
  FeedAuthor,
  ReviewItem,
  ReviewKind,
  ReviewPage,
} from "../lib/types";
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
});

/** Flagged, uncleared content, newest flag first, across all three tables. */
export async function getSevereReviewPage(
  db: Db,
  cursor: string | null,
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
      after(table),
    );

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
      .where(flagged(postTable))
      .orderBy(desc(postTable.modFlaggedAt), desc(postTable.id))
      .limit(PAGE_SIZE + 1),
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
      ...posts.map((row) => toItem("post", row)),
      ...comments.map((row) => toItem("comment", row)),
      ...notes.map((row) => toItem("note", row)),
    ],
    (item) => item.flaggedAt,
  );
  const page = merged.slice(0, PAGE_SIZE);
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
export async function getDramaReviewPage(db: Db): Promise<ReviewPage> {
  // Newest rows first, filtered here rather than in SQL: a WHERE on mod_drama
  // with no index to serve it could walk the whole table when matches are
  // rare, and Turso bills every row scanned.
  const [posts, comments, notes] = await Promise.all([
    db
      .select({
        id: postTable.id,
        content: postTable.content,
        createdAt: postTable.createdAt,
        clearedAt: postTable.modClearedAt,
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
        clearedAt: postCommentTable.modClearedAt,
        ...scoreFields(postCommentTable),
        author: feedAuthorColumns,
      })
      .from(postCommentTable)
      .innerJoin(userTable, eq(postCommentTable.authorId, userTable.id))
      .orderBy(desc(postCommentTable.createdAt), desc(postCommentTable.id))
      .limit(DRAMA_WINDOW),
    db
      .select({
        id: noteTable.id,
        content: noteTable.content,
        createdAt: noteTable.createdAt,
        isAnonymous: noteTable.isAnonymous,
        clearedAt: noteTable.modClearedAt,
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
      ...posts.filter(isCandidate).map((row) => toItem("post", row)),
      ...comments.filter(isCandidate).map((row) => toItem("comment", row)),
      ...notes.filter(isCandidate).map((row) => toItem("note", row)),
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
    isAnonymous?: boolean;
    severe: number | null;
    drama: number | null;
    reason: string | null;
    flaggedAt: Date | null;
    author: FeedAuthor;
  },
): ReviewItem {
  return {
    kind,
    id: row.id,
    content: row.content,
    author: row.isAnonymous ? null : row.author,
    postId: row.postId ?? null,
    createdAt: row.createdAt,
    flaggedAt: row.flaggedAt,
    severe: row.severe,
    drama: row.drama,
    reason: row.reason,
  };
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
