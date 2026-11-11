import {
  postCommentTable,
  postRepostTable,
  postTable,
} from "@umamin/db/schema/post";
import { type SQL, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";

// SET expressions for the people counts Hot ranks on (commenterCount,
// likerCount, voterCount, resharerCount on postTable). Each runs inside an
// UPDATE of the post itself, so `postTable` here is the row being updated.
// The +1 and -1 sides use the same tests, so a count can't drift from a
// write that half-matches.

const quote = alias(postTable, "hot_quote");

const notAuthor = (userId: string) => sql`${postTable.authorId} <> ${userId}`;

/** +1 unless the actor is the post's author. For one-per-person rows. */
export function addOther(column: SQLiteColumn, userId: string): SQL {
  return sql`${column} + CASE WHEN ${notAuthor(userId)} THEN 1 ELSE 0 END`;
}

/** The matching -1 for addOther. */
export function removeOther(column: SQLiteColumn, userId: string): SQL {
  return sql`MAX(0, ${column} - CASE WHEN ${notAuthor(userId)} THEN 1 ELSE 0 END)`;
}

/** Whether userId has a comment on postId other than exceptId. */
export function hasCommented(
  userId: string,
  postId: string,
  exceptId?: string,
): SQL {
  return sql`EXISTS (
    SELECT 1 FROM ${postCommentTable}
    WHERE ${postCommentTable.authorId} = ${userId}
      AND ${postCommentTable.postId} = ${postId}
      ${exceptId ? sql`AND ${postCommentTable.id} <> ${exceptId}` : sql``}
  )`;
}

/** After inserting commentId: +1 if it's the actor's first comment here. */
export function addCommenter(
  userId: string,
  postId: string,
  commentId: string,
): SQL {
  return sql`${postTable.commenterCount} + CASE WHEN ${notAuthor(userId)} AND NOT ${hasCommented(userId, postId, commentId)} THEN 1 ELSE 0 END`;
}

/** After deleting a comment: -1 if the actor has none left here. */
export function removeCommenter(userId: string, postId: string): SQL {
  return sql`MAX(0, ${postTable.commenterCount} - CASE WHEN ${notAuthor(userId)} AND NOT ${hasCommented(userId, postId)} THEN 1 ELSE 0 END)`;
}

function hasReposted(userId: string) {
  return sql`EXISTS (
    SELECT 1 FROM ${postRepostTable}
    WHERE ${postRepostTable.postId} = ${postTable.id}
      AND ${postRepostTable.userId} = ${userId}
  )`;
}

// Whether userId has a repost or a quote of the post being updated. `repost:
// false` skips the repost table, for the repost insert itself.
function hasShared(
  userId: string,
  opts: { repost: boolean; exceptQuoteId?: string },
) {
  const quoted = sql`EXISTS (
    SELECT 1 FROM ${postTable} AS ${quote}
    WHERE ${quote.quotedPostId} = ${postTable.id}
      AND ${quote.authorId} = ${userId}
      ${opts.exceptQuoteId ? sql`AND ${quote.id} <> ${opts.exceptQuoteId}` : sql``}
  )`;
  if (!opts.repost) return quoted;
  return sql`(${quoted} OR ${hasReposted(userId)})`;
}

/**
 * After a repost or quote lands: +1 if it's the actor's first share of the
 * post. Pass `quoteId` for a quote, so the new quote doesn't count as an
 * earlier share; leave it out for a repost.
 */
export function addResharer(userId: string, quoteId?: string): SQL {
  const earlier = quoteId
    ? hasShared(userId, { repost: true, exceptQuoteId: quoteId })
    : hasShared(userId, { repost: false });
  return sql`${postTable.resharerCount} + CASE WHEN ${notAuthor(userId)} AND NOT ${earlier} THEN 1 ELSE 0 END`;
}

/** After a repost or quote is deleted: -1 if the actor has no share left. */
export function removeResharer(userId: string): SQL {
  return sql`MAX(0, ${postTable.resharerCount} - CASE WHEN ${notAuthor(userId)} AND NOT ${hasShared(userId, { repost: true })} THEN 1 ELSE 0 END)`;
}

/** Account deletion, quotes pass: -1 unless the repost pass already did it. */
export function removeQuoterKeepingReposters(userId: string): SQL {
  return sql`MAX(0, ${postTable.resharerCount} - CASE WHEN ${notAuthor(userId)} AND NOT ${hasReposted(userId)} THEN 1 ELSE 0 END)`;
}
