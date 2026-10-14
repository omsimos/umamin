import { postCommentTable } from "@umamin/db/schema/post";
import { and, desc, eq, lte, ne } from "drizzle-orm";
import type { Db } from "./db";

// Context the classifier sees alongside a row's own text. Shared by the write
// paths and the unclassified-row retry so both judge a row the same way.

const THREAD_CONTEXT_COMMENTS = 3;

/** The text a post is classified on: the stored content plus any poll labels,
 *  which a user writes and readers see but which aren't part of `content`. */
export function postClassifierText(
  content: string,
  pollLabels: readonly string[] | null | undefined,
) {
  return pollLabels?.length
    ? `${content}\nPoll options: ${pollLabels.join(", ")}`
    : content;
}

/** Up to three of the latest comments by other people on a post, oldest
 *  first. A seek on post_comment_post_created_idx. */
export async function getEarlierComments(
  db: Db,
  input: {
    postId: string;
    authorId: string;
    // For a retry: only what existed when the comment was written.
    before?: { id: string; createdAt: Date };
  },
): Promise<string[]> {
  const rows = await db
    .select({ content: postCommentTable.content })
    .from(postCommentTable)
    .where(
      and(
        eq(postCommentTable.postId, input.postId),
        ne(postCommentTable.authorId, input.authorId),
        input.before
          ? and(
              lte(postCommentTable.createdAt, input.before.createdAt),
              ne(postCommentTable.id, input.before.id),
            )
          : undefined,
      ),
    )
    .orderBy(desc(postCommentTable.createdAt))
    .limit(THREAD_CONTEXT_COMMENTS);
  return rows.map((row) => row.content).reverse();
}
