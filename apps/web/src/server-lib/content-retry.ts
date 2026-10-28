import { noteTable } from "@umamin/db/schema/note";
import {
  pollOptionTable,
  postCommentTable,
  postTable,
} from "@umamin/db/schema/post";
import {
  and,
  asc,
  count,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  ne,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { classifyContentWithOutcome } from "./content-classifier";
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
// Read more candidates than one batch so rows that already gave up don't fill it.
const RETRY_CANDIDATES = RETRY_BATCH * 3;
const RETRY_CONCURRENCY = 4;
const RETRY_TIMEOUT_MS = 8000;
// A row the Gateway keeps rejecting for good (not a timeout or a 5xx) would be
// re-sent every 5 minutes for the whole window and starve the rows behind it.
// The counter lives in KV, expires just after the window, and is a no-op
// without the binding.
const MAX_PERMANENT_ATTEMPTS = 3;
const ATTEMPT_TTL_SECONDS = 7 * 60 * 60;
// The unclassified count at which the cron reports a backlog.
export const BACKLOG_ALERT = 100;

type Defer = (promise: Promise<unknown>) => void;
type Kind = "post" | "comment" | "note";

const attemptKey = (kind: Kind, id: string) => `clsretry:${kind}:${id}`;

async function readAttempts(env: AppEnv, kind: Kind, id: string) {
  if (!env.KV) return 0;
  try {
    return Number(await env.KV.get(attemptKey(kind, id))) || 0;
  } catch {
    return 0;
  }
}

// Drops rows that already gave up, then keeps the oldest batch of the rest.
async function withAttempts<T extends { id: string }>(
  env: AppEnv,
  kind: Kind,
  rows: T[],
) {
  const counted = await Promise.all(
    rows.map(async (row) => ({
      row,
      attempts: await readAttempts(env, kind, row.id),
    })),
  );
  return counted
    .filter(({ attempts }) => attempts < MAX_PERMANENT_ATTEMPTS)
    .slice(0, RETRY_BATCH);
}

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
): Promise<{ attempted: number; classified: number; backlog: number }> {
  if (!env.AI_GATEWAY_API_KEY)
    return { attempted: 0, classified: 0, backlog: 0 };

  const now = Date.now();
  const from = new Date(now - RETRY_WINDOW_MS);
  const to = new Date(now - RETRY_MIN_AGE_MS);
  const quoted = alias(postTable, "quoted");

  // Oldest first, so rows nearest the window's edge are tried before they age
  // out. Each query rides its table's partial unclassified index.
  const [candidatePosts, candidateComments, candidateNotes] = await Promise.all(
    [
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
        .orderBy(asc(postTable.createdAt))
        .limit(RETRY_CANDIDATES),
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
            gte(postCommentTable.createdAt, from),
            lte(postCommentTable.createdAt, to),
            isNull(postCommentTable.modSevere),
          ),
        )
        .orderBy(asc(postCommentTable.createdAt))
        .limit(RETRY_CANDIDATES),
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
        .orderBy(asc(noteTable.updatedAt))
        .limit(RETRY_CANDIDATES),
    ],
  );

  const [posts, comments, notes] = await Promise.all([
    withAttempts(env, "post", candidatePosts),
    withAttempts(env, "comment", candidateComments),
    withAttempts(env, "note", candidateNotes),
  ]);

  const pollPostIds = posts
    .filter(({ row }) => row.pollEndsAt)
    .map(({ row }) => row.id);
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

  // Only a permanent failure counts toward giving up; a transient one is
  // bounded by the window. The first attempt reports a failure, the rest only
  // log it, so one bad row is one report instead of one per cron run.
  const classify = async (
    kind: Kind,
    id: string,
    attempts: number,
    input: Parameters<typeof classifyContentWithOutcome>[1],
  ) => {
    const { scores, failure } = await classifyContentWithOutcome(env, input, {
      defer,
      timeoutMs: RETRY_TIMEOUT_MS,
      report: attempts === 0,
    });
    if (failure === "permanent" && env.KV) {
      try {
        await env.KV.put(attemptKey(kind, id), String(attempts + 1), {
          expirationTtl: ATTEMPT_TTL_SECONDS,
        });
      } catch {
        // A KV error must not fail the cron.
      }
    }
    return scores;
  };
  const landed = (result: { rowsAffected?: number }) =>
    (result.rowsAffected ?? 0) > 0;

  // Each write lands only on a row that is still unclassified and unchanged,
  // so an edited note never gets its old text's scores. updatedAt is pinned:
  // $onUpdate would otherwise restamp it, and a note's updated_at is both its
  // feed position and that staleness guard.
  const tasks: (() => Promise<boolean>)[] = [
    ...posts.map(({ row: post, attempts }) => async () => {
      const scores = await classify("post", post.id, attempts, {
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
    ...comments.map(({ row: comment, attempts }) => async () => {
      const thread = await getEarlierComments(db, {
        postId: comment.postId,
        authorId: comment.authorId,
        before: { id: comment.id, createdAt: comment.createdAt },
      });
      const scores = await classify("comment", comment.id, attempts, {
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
    ...notes.map(({ row: note, attempts }) => async () => {
      const { updatedAt } = note;
      if (!updatedAt) return false;
      const scores = await classify("note", note.id, attempts, {
        kind: "note",
        text: note.content,
      });
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

  // One count per table over the same window; each rides the partial
  // unclassified index, so a clean window reads ~0 rows.
  const unclassifiedSince = (
    table: typeof postTable | typeof postCommentTable,
  ) =>
    db
      .select({ n: count() })
      .from(table)
      .where(and(gte(table.createdAt, from), isNull(table.modSevere)));
  const [[postCount], [commentCount], [noteCount]] = await Promise.all([
    unclassifiedSince(postTable),
    unclassifiedSince(postCommentTable),
    db
      .select({ n: count() })
      .from(noteTable)
      .where(
        and(
          gte(noteTable.updatedAt, from),
          isNull(noteTable.modSevere),
          ne(noteTable.content, ""),
        ),
      ),
  ]);
  const backlog =
    (postCount?.n ?? 0) + (commentCount?.n ?? 0) + (noteCount?.n ?? 0);

  return { attempted: tasks.length, classified, backlog };
}
