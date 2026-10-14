import { noteTable } from "@umamin/db/schema/note";
import {
  pollOptionTable,
  postCommentTable,
  postTable,
} from "@umamin/db/schema/post";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  ne,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { classifyContent } from "./content-classifier";
import { getEarlierComments, postClassifierText } from "./content-context";
import { reviewableScoreColumns } from "./content-label";
import type { Db } from "./db";
import type { AppEnv } from "./env";

// A write that timed out or hit a rate limit stores its row unclassified. This
// re-classifies the recent ones from the */5 cron. Messages are left out: null
// there also means the receiver never opted in to classification.

const RETRY_WINDOW_MS = 6 * 60 * 60 * 1000;
// A failure that just happened is usually the Gateway struggling; resending at
// once would likely fail the same way.
const RETRY_MIN_AGE_MS = 60 * 1000;
const RETRY_BATCH = 10;
// post_comment has no created_at index, so its window is the newest rows by
// rowid (insertion order): a primary-key range instead of a full scan.
const COMMENT_SCAN_ROWS = 200;
const RETRY_CONCURRENCY = 4;
const RETRY_TIMEOUT_MS = 8000;

type Defer = (promise: Promise<unknown>) => void;

async function runPool(tasks: (() => Promise<boolean>)[]) {
  let next = 0;
  let landed = 0;
  await Promise.all(
    Array.from(
      { length: Math.min(RETRY_CONCURRENCY, tasks.length) },
      async () => {
        while (next < tasks.length) {
          const task = tasks[next++];
          if (await task()) landed++;
        }
      },
    ),
  );
  return landed;
}

export async function retryUnclassifiedContent(
  db: Db,
  env: AppEnv,
  defer?: Defer,
): Promise<{ attempted: number; classified: number }> {
  if (!env.AI_GATEWAY_API_KEY) return { attempted: 0, classified: 0 };

  const now = Date.now();
  const from = new Date(now - RETRY_WINDOW_MS);
  const to = new Date(now - RETRY_MIN_AGE_MS);
  const quoted = alias(postTable, "quoted");
  const commentRowid = sql`${postCommentTable}.rowid`;

  const [posts, comments, notes] = await Promise.all([
    db
      .select({
        id: postTable.id,
        content: postTable.content,
        pollEndsAt: postTable.pollEndsAt,
        quotedContent: quoted.content,
      })
      .from(postTable)
      .leftJoin(quoted, eq(quoted.id, postTable.quotedPostId))
      .where(
        and(
          gte(postTable.createdAt, from),
          lte(postTable.createdAt, to),
          isNull(postTable.modSevere),
        ),
      )
      .orderBy(desc(postTable.createdAt))
      .limit(RETRY_BATCH),
    db
      .select({
        id: postCommentTable.id,
        content: postCommentTable.content,
        postId: postCommentTable.postId,
        authorId: postCommentTable.authorId,
        createdAt: postCommentTable.createdAt,
        postContent: postTable.content,
      })
      .from(postCommentTable)
      .innerJoin(postTable, eq(postTable.id, postCommentTable.postId))
      .where(
        and(
          sql`${commentRowid} > (SELECT max(rowid) FROM ${postCommentTable}) - ${sql.raw(String(COMMENT_SCAN_ROWS))}`,
          gte(postCommentTable.createdAt, from),
          lte(postCommentTable.createdAt, to),
          isNull(postCommentTable.modSevere),
        ),
      )
      .orderBy(desc(commentRowid))
      .limit(RETRY_BATCH),
    db
      .select({
        id: noteTable.id,
        content: noteTable.content,
        updatedAt: noteTable.updatedAt,
      })
      .from(noteTable)
      .where(
        and(
          gte(noteTable.updatedAt, from),
          lte(noteTable.updatedAt, to),
          isNull(noteTable.modSevere),
          ne(noteTable.content, ""),
        ),
      )
      .orderBy(desc(noteTable.updatedAt))
      .limit(RETRY_BATCH),
  ]);

  const pollPostIds = posts.filter((p) => p.pollEndsAt).map((p) => p.id);
  const pollLabels = new Map<string, string[]>();
  if (pollPostIds.length > 0) {
    const options = await db
      .select({ postId: pollOptionTable.postId, label: pollOptionTable.label })
      .from(pollOptionTable)
      .where(inArray(pollOptionTable.postId, pollPostIds))
      .orderBy(asc(pollOptionTable.postId), asc(pollOptionTable.idx));
    for (const option of options) {
      const labels = pollLabels.get(option.postId) ?? [];
      labels.push(option.label);
      pollLabels.set(option.postId, labels);
    }
  }

  const classify = (input: Parameters<typeof classifyContent>[1]) =>
    classifyContent(env, input, { defer, timeoutMs: RETRY_TIMEOUT_MS });
  const landed = (result: { rowsAffected?: number }) =>
    (result.rowsAffected ?? 0) > 0;

  // Each write lands only on a row that is still unclassified and unchanged,
  // so an edited note never gets its old text's scores. updatedAt is pinned:
  // $onUpdate would otherwise restamp it, and a note's updated_at is both its
  // feed position and that staleness guard.
  const tasks: (() => Promise<boolean>)[] = [
    ...posts.map((post) => async () => {
      const scores = await classify({
        kind: "post",
        text: postClassifierText(post.content, pollLabels.get(post.id)),
        context: post.quotedContent,
      });
      if (!scores) return false;
      return landed(
        await db
          .update(postTable)
          .set({
            ...reviewableScoreColumns(scores),
            updatedAt: sql`${postTable.updatedAt}`,
          })
          .where(
            and(
              eq(postTable.id, post.id),
              isNull(postTable.modSevere),
              eq(postTable.content, post.content),
            ),
          ),
      );
    }),
    ...comments.map((comment) => async () => {
      const thread = await getEarlierComments(db, {
        postId: comment.postId,
        authorId: comment.authorId,
        before: { id: comment.id, createdAt: comment.createdAt },
      });
      const scores = await classify({
        kind: "comment",
        text: comment.content,
        context: comment.postContent,
        thread,
      });
      if (!scores) return false;
      return landed(
        await db
          .update(postCommentTable)
          .set({
            ...reviewableScoreColumns(scores),
            updatedAt: sql`${postCommentTable.updatedAt}`,
          })
          .where(
            and(
              eq(postCommentTable.id, comment.id),
              isNull(postCommentTable.modSevere),
              eq(postCommentTable.content, comment.content),
            ),
          ),
      );
    }),
    ...notes.map((note) => async () => {
      const { updatedAt } = note;
      if (!updatedAt) return false;
      const scores = await classify({ kind: "note", text: note.content });
      if (!scores) return false;
      return landed(
        await db
          .update(noteTable)
          .set({
            ...reviewableScoreColumns(scores),
            updatedAt: sql`${noteTable.updatedAt}`,
          })
          .where(
            and(
              eq(noteTable.id, note.id),
              isNull(noteTable.modSevere),
              eq(noteTable.content, note.content),
              eq(noteTable.updatedAt, updatedAt),
            ),
          ),
      );
    }),
  ];

  const classified = await runPool(tasks);
  return { attempted: tasks.length, classified };
}
