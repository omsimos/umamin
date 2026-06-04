import "server-only";

import { db } from "@umamin/db";
import { messageTable } from "@umamin/db/schema/message";
import { noteReactionTable, noteTable } from "@umamin/db/schema/note";
import {
  postCommentLikeTable,
  postCommentTable,
  postLikeTable,
  postRepostTable,
  postTable,
  type SelectPost,
} from "@umamin/db/schema/post";
import {
  accountTable,
  userBlockTable,
  userFollowTable,
  userTable,
} from "@umamin/db/schema/user";
import { aesDecrypt } from "@umamin/encryption";
import {
  and,
  desc,
  eq,
  exists,
  inArray,
  isNull,
  lt,
  not,
  or,
  sql,
} from "drizzle-orm";
import { unionAll } from "drizzle-orm/sqlite-core";
import { cacheLife, cacheTag } from "next/cache";
import type { FeedSort } from "@/lib/feed-sort";
import type {
  CommentsResponse,
  CurrentUserResponse,
  FeedResponse,
  FollowListResponse,
  MessagesResponse,
  NoteItem,
  NotesResponse,
  PostResponse,
  UserProfileResponse,
  UserProfileViewerResponse,
} from "@/lib/query-types";
import {
  getRedisHotPostIdsPage,
  isRedisHotCursor,
} from "@/lib/server/feed-rank";
import type { CommentData, FeedItem } from "@/types/post";
import type { CurrentUserClient, PublicUser } from "@/types/user";

const PUBLIC_REVALIDATE_SECONDS = 120;
const PRIVATE_REVALIDATE_SECONDS = 30;
// 20 matches comments/messages and the virtualized above-the-fold (overscan 5);
// 40 over-fetched ~2x the rows + payload per page on a per-row-billed DB.
const FEED_PAGE_SIZE = 20;
const HOT_FEED_CANDIDATE_SIZE = 100;
const COMMENTS_PAGE_SIZE = 20;
const MESSAGES_PAGE_SIZE = 20;
const FOLLOW_LIST_PAGE_SIZE = 20;

type FeedCursor = {
  createdAt: Date;
  edgeId: string;
  kindPriority: 0 | 1;
};

type FeedEdgeRow = {
  kind: "post" | "repost";
  kindPriority: 0 | 1;
  edgeId: string;
  createdAt: Date;
  postId: string;
  authorId: string;
  reposterId: string | null;
  repostContent: string | null;
};

type HotFeedCursor = {
  rankedAtMs: number;
  scoreKey: number;
  createdAtMs: number;
  postId: string;
};

type HotFeedCandidate = {
  post: SelectPost;
  scoreKey: number;
};

const publicUserColumns = {
  id: userTable.id,
  username: userTable.username,
  displayName: userTable.displayName,
  bio: userTable.bio,
  imageUrl: userTable.imageUrl,
  quietMode: userTable.quietMode,
  question: userTable.question,
  followerCount: userTable.followerCount,
  followingCount: userTable.followingCount,
  createdAt: userTable.createdAt,
  updatedAt: userTable.updatedAt,
};

function parseFeedCursor(cursor: string | null): FeedCursor | null {
  if (!cursor) {
    return null;
  }

  const [msRaw, kindPriorityRaw, edgeId] = cursor.split(".");
  const ms = Number(msRaw);
  const kindPriority =
    kindPriorityRaw === "1" ? 1 : kindPriorityRaw === "0" ? 0 : null;
  const createdAt = Number.isNaN(ms) ? null : new Date(ms);

  if (!createdAt || !edgeId || kindPriority === null) {
    return null;
  }

  return {
    createdAt,
    edgeId,
    kindPriority,
  };
}

function parseHotFeedCursor(cursor: string | null): HotFeedCursor | null {
  if (!cursor) {
    return null;
  }

  const [rankedAtRaw, scoreRaw, createdAtRaw, postId] = cursor.split(".");
  const rankedAtMs = Number(rankedAtRaw);
  const scoreKey = Number(scoreRaw);
  const createdAtMs = Number(createdAtRaw);

  if (
    Number.isNaN(rankedAtMs) ||
    Number.isNaN(scoreKey) ||
    Number.isNaN(createdAtMs) ||
    !postId
  ) {
    return null;
  }

  return {
    rankedAtMs,
    scoreKey,
    createdAtMs,
    postId,
  };
}

function parseCursor(cursor: string | null) {
  if (!cursor) return null;

  const sep = cursor.indexOf(".");
  if (sep <= 0) return null;

  const ms = Number(cursor.slice(0, sep));
  const cursorId = cursor.slice(sep + 1);
  const cursorDate = new Date(ms);

  return {
    cursorId,
    cursorDate,
  };
}

function getFeedNextCursor(edge?: FeedEdgeRow) {
  if (!edge) return null;

  return `${edge.createdAt.getTime()}.${edge.kindPriority}.${edge.edgeId}`;
}

function getHotFeedNextCursor(
  rankedAtMs: number,
  candidate?: HotFeedCandidate,
) {
  if (!candidate) return null;

  return `${rankedAtMs}.${candidate.scoreKey}.${candidate.post.createdAt.getTime()}.${candidate.post.id}`;
}

function getHotFeedScoreKey(post: SelectPost, rankedAtMs: number) {
  const engagement =
    post.likeCount + post.commentCount * 3 + post.repostCount * 4;
  const createdAtMs = post.createdAt.getTime();
  const ageHours = Math.max(0, (rankedAtMs - createdAtMs) / 3_600_000);
  const score = (1.5 + Math.log1p(engagement)) / (ageHours + 2) ** 1.15;

  return Math.round(score * 1_000_000);
}

function getHotFeedRankedAtMs(cursor: string | null) {
  const parsedCursor = parseHotFeedCursor(cursor);

  if (parsedCursor) {
    return parsedCursor.rankedAtMs;
  }

  const revalidateMs = PUBLIC_REVALIDATE_SECONDS * 1000;
  return Math.floor(Date.now() / revalidateMs) * revalidateMs;
}

function compareHotCandidates(left: HotFeedCandidate, right: HotFeedCandidate) {
  if (left.scoreKey !== right.scoreKey) {
    return right.scoreKey - left.scoreKey;
  }

  const leftCreatedAt = left.post.createdAt.getTime();
  const rightCreatedAt = right.post.createdAt.getTime();

  if (leftCreatedAt !== rightCreatedAt) {
    return rightCreatedAt - leftCreatedAt;
  }

  return right.post.id.localeCompare(left.post.id);
}

function diversifyHotCandidates(candidates: HotFeedCandidate[]) {
  const result = [...candidates];

  for (let index = 1; index < result.length; index += 1) {
    const previous = result[index - 1];
    const current = result[index];

    if (previous.post.authorId !== current.post.authorId) {
      continue;
    }

    const replacementIndex = result.findIndex(
      (candidate, candidateIndex) =>
        candidateIndex > index &&
        candidateIndex <= index + 4 &&
        candidate.post.authorId !== previous.post.authorId &&
        candidate.scoreKey >= current.scoreKey * 0.85,
    );

    if (replacementIndex === -1) {
      continue;
    }

    const [replacement] = result.splice(replacementIndex, 1);
    result.splice(index, 0, replacement);
  }

  return result;
}

function isAfterHotCursor(
  candidate: HotFeedCandidate,
  cursor: HotFeedCursor | null,
) {
  if (!cursor) {
    return true;
  }

  const createdAtMs = candidate.post.createdAt.getTime();

  if (candidate.scoreKey !== cursor.scoreKey) {
    return candidate.scoreKey < cursor.scoreKey;
  }

  if (createdAtMs !== cursor.createdAtMs) {
    return createdAtMs < cursor.createdAtMs;
  }

  return candidate.post.id < cursor.postId;
}

function getPageRows<T>(rows: T[], pageSize: number) {
  const hasMore = rows.length > pageSize;

  return {
    hasMore,
    pageRows: hasMore ? rows.slice(0, pageSize) : rows,
  };
}

function getFeedCursorCondition(
  createdAtColumn:
    | typeof postTable.createdAt
    | typeof postRepostTable.createdAt,
  idColumn: typeof postTable.id | typeof postRepostTable.id,
  kindPriority: 0 | 1,
  cursor: FeedCursor | null,
) {
  if (!cursor) {
    return undefined;
  }

  const sameTimestampCondition =
    kindPriority < cursor.kindPriority
      ? sql`1 = 1`
      : kindPriority > cursor.kindPriority
        ? sql`0 = 1`
        : lt(idColumn, cursor.edgeId);

  return or(
    lt(createdAtColumn, cursor.createdAt),
    and(eq(createdAtColumn, cursor.createdAt), sameTimestampCondition),
  );
}

async function getPublicLatestPostsPage(
  cursor: string | null,
): Promise<FeedResponse> {
  "use cache";
  cacheTag("posts");
  cacheLife({ revalidate: PUBLIC_REVALIDATE_SECONDS });

  const parsedCursor = parseFeedCursor(cursor);
  const postCursorCondition = getFeedCursorCondition(
    postTable.createdAt,
    postTable.id,
    0,
    parsedCursor,
  );
  const repostCursorCondition = getFeedCursorCondition(
    postRepostTable.createdAt,
    postRepostTable.id,
    1,
    parsedCursor,
  );

  // Bound each branch to the page window *before* the union, so a cache miss
  // reads ~PAGE_SIZE rows per table instead of scanning every post + repost
  // (Turso bills every row scanned). Taking the top (PAGE_SIZE + 1) from each
  // branch and re-sorting the merged set yields the same global page.
  // edge_id / post_id get distinct SQL aliases to avoid an ambiguous "id"/"id"
  // collision once each branch is wrapped as a subquery for the union.
  const postEdgesBase = db
    .select({
      kind: sql<string>`'post'`.as("kind"),
      kindPriority: sql<number>`0`.as("kindPriority"),
      edgeId: sql<string>`${postTable.id}`.as("edge_id"),
      createdAt: postTable.createdAt,
      postId: sql<string>`${postTable.id}`.as("post_id"),
      authorId: postTable.authorId,
      reposterId: sql<string | null>`null`.as("reposter_id"),
      repostContent: sql<string | null>`null`.as("repost_content"),
    })
    .from(postTable)
    .$dynamic();

  const postEdges = (
    postCursorCondition
      ? postEdgesBase.where(postCursorCondition)
      : postEdgesBase
  )
    .orderBy(desc(postTable.createdAt), desc(postTable.id))
    .limit(FEED_PAGE_SIZE + 1)
    .as("post_edges");

  const repostEdgesBase = db
    .select({
      kind: sql<string>`'repost'`.as("kind"),
      kindPriority: sql<number>`1`.as("kindPriority"),
      edgeId: sql<string>`${postRepostTable.id}`.as("edge_id"),
      createdAt: postRepostTable.createdAt,
      postId: sql<string>`${postRepostTable.postId}`.as("post_id"),
      authorId: postTable.authorId,
      reposterId: sql<string | null>`${postRepostTable.userId}`.as(
        "reposter_id",
      ),
      repostContent: sql<string | null>`${postRepostTable.content}`.as(
        "repost_content",
      ),
    })
    .from(postRepostTable)
    .innerJoin(postTable, eq(postRepostTable.postId, postTable.id))
    .$dynamic();

  const repostEdges = (
    repostCursorCondition
      ? repostEdgesBase.where(repostCursorCondition)
      : repostEdgesBase
  )
    .orderBy(desc(postRepostTable.createdAt), desc(postRepostTable.id))
    .limit(FEED_PAGE_SIZE + 1)
    .as("repost_edges");

  const feedEdges = unionAll(
    db.select().from(postEdges),
    db.select().from(repostEdges),
  ).as("feed_edges");
  const edgeRows = await db
    .select()
    .from(feedEdges)
    .orderBy(
      desc(feedEdges.createdAt),
      desc(feedEdges.kindPriority),
      desc(feedEdges.edgeId),
    )
    .limit(FEED_PAGE_SIZE + 1);

  const { hasMore, pageRows } = getPageRows(
    edgeRows as FeedEdgeRow[],
    FEED_PAGE_SIZE,
  );
  const postIds = Array.from(new Set(pageRows.map((edge) => edge.postId)));
  const userIds = Array.from(
    new Set(
      pageRows.flatMap(
        (edge) => [edge.authorId, edge.reposterId].filter(Boolean) as string[],
      ),
    ),
  );

  const [posts, users] = await Promise.all([
    postIds.length > 0
      ? db.select().from(postTable).where(inArray(postTable.id, postIds))
      : [],
    userIds.length > 0
      ? db
          .select(publicUserColumns)
          .from(userTable)
          .where(inArray(userTable.id, userIds))
      : [],
  ]);

  const postMap = new Map(posts.map((post) => [post.id, post] as const));
  const userMap = new Map(users.map((user) => [user.id, user] as const));
  const data: FeedItem[] = pageRows.flatMap<FeedItem>((edge) => {
    const post = postMap.get(edge.postId);
    const author = userMap.get(edge.authorId);

    if (!post || !author) {
      return [];
    }

    const feedPost = {
      ...post,
      author,
      isLiked: false,
      isReposted: false,
    };

    if (edge.kind === "post") {
      return [{ type: "post" as const, post: feedPost }];
    }

    const reposter = edge.reposterId ? userMap.get(edge.reposterId) : null;

    if (!reposter) {
      return [];
    }

    return [
      {
        type: "repost" as const,
        post: feedPost,
        repost: {
          id: edge.edgeId,
          postId: edge.postId,
          content: edge.repostContent ?? undefined,
          createdAt: edge.createdAt,
          user: reposter,
        },
      },
    ];
  });

  return {
    data,
    nextCursor: hasMore
      ? getFeedNextCursor(pageRows[pageRows.length - 1])
      : null,
  };
}

async function getRedisHotPostsPage(
  cursor: string | null,
): Promise<FeedResponse | null> {
  const page = await getRedisHotPostIdsPage(
    cursor,
    FEED_PAGE_SIZE,
    HOT_FEED_CANDIDATE_SIZE,
  );

  if (!page) {
    return null;
  }

  const posts =
    page.ids.length > 0
      ? await db.select().from(postTable).where(inArray(postTable.id, page.ids))
      : [];
  const authorIds = Array.from(new Set(posts.map((post) => post.authorId)));
  const users =
    authorIds.length > 0
      ? await db
          .select(publicUserColumns)
          .from(userTable)
          .where(inArray(userTable.id, authorIds))
      : [];

  const postMap = new Map(posts.map((post) => [post.id, post] as const));
  const userMap = new Map(users.map((user) => [user.id, user] as const));
  const data: FeedItem[] = page.ids.flatMap<FeedItem>((postId) => {
    const post = postMap.get(postId);
    const author = post ? userMap.get(post.authorId) : null;

    if (!post || !author) {
      return [];
    }

    return [
      {
        type: "post" as const,
        post: {
          ...post,
          author,
          isLiked: false,
          isReposted: false,
        },
      },
    ];
  });

  return {
    data,
    nextCursor: page.nextCursor,
  };
}

async function getCachedPublicHotPostsPage(
  cursor: string | null,
  rankedAtMs: number,
): Promise<FeedResponse> {
  "use cache";
  cacheTag("posts");
  cacheLife({ revalidate: PUBLIC_REVALIDATE_SECONDS });

  const parsedCursor = parseHotFeedCursor(cursor);

  const candidatePosts = await db
    .select()
    .from(postTable)
    .orderBy(desc(postTable.createdAt), desc(postTable.id))
    .limit(HOT_FEED_CANDIDATE_SIZE);

  const rankedCandidates = candidatePosts
    .map((post) => ({
      post,
      scoreKey: getHotFeedScoreKey(post, rankedAtMs),
    }))
    .sort(compareHotCandidates)
    .filter((candidate) => isAfterHotCursor(candidate, parsedCursor));

  const { hasMore, pageRows: scorePageRows } = getPageRows(
    rankedCandidates,
    FEED_PAGE_SIZE,
  );
  const pageRows = diversifyHotCandidates(scorePageRows);
  const authorIds = Array.from(
    new Set(pageRows.map((candidate) => candidate.post.authorId)),
  );

  const users =
    authorIds.length > 0
      ? await db
          .select(publicUserColumns)
          .from(userTable)
          .where(inArray(userTable.id, authorIds))
      : [];

  const userMap = new Map(users.map((user) => [user.id, user] as const));
  const data: FeedItem[] = pageRows.flatMap<FeedItem>(({ post }) => {
    const author = userMap.get(post.authorId);

    if (!author) {
      return [];
    }

    return [
      {
        type: "post" as const,
        post: {
          ...post,
          author,
          isLiked: false,
          isReposted: false,
        },
      },
    ];
  });

  return {
    data,
    nextCursor: hasMore
      ? getHotFeedNextCursor(
          rankedAtMs,
          scorePageRows[scorePageRows.length - 1],
        )
      : null,
  };
}

async function getPublicHotPostsPage(
  cursor: string | null,
  rankedAtMs: number,
): Promise<FeedResponse> {
  const redisData =
    !cursor || isRedisHotCursor(cursor)
      ? await getRedisHotPostsPage(cursor)
      : null;

  if (isRedisHotCursor(cursor)) {
    return redisData ?? { data: [], nextCursor: null };
  }

  return redisData ?? (await getCachedPublicHotPostsPage(cursor, rankedAtMs));
}

async function getFollowingPostsPage(
  viewerId: string,
  cursor: string | null,
): Promise<FeedResponse> {
  "use cache";
  cacheTag(`feed-following:${viewerId}`);
  cacheTag(`user-following:${viewerId}`);
  cacheLife({ revalidate: PRIVATE_REVALIDATE_SECONDS });

  const parsedCursor = parseFeedCursor(cursor);
  const postCursorCondition = getFeedCursorCondition(
    postTable.createdAt,
    postTable.id,
    0,
    parsedCursor,
  );
  const repostCursorCondition = getFeedCursorCondition(
    postRepostTable.createdAt,
    postRepostTable.id,
    1,
    parsedCursor,
  );

  const postEdgesBase = db
    .select({
      kind: sql<string>`'post'`.as("kind"),
      kindPriority: sql<number>`0`.as("kindPriority"),
      edgeId: sql<string>`${postTable.id}`.as("edge_id"),
      createdAt: postTable.createdAt,
      postId: sql<string>`${postTable.id}`.as("post_id"),
      authorId: postTable.authorId,
      reposterId: sql<string | null>`null`.as("reposter_id"),
      repostContent: sql<string | null>`null`.as("repost_content"),
    })
    .from(postTable)
    .innerJoin(
      userFollowTable,
      and(
        eq(userFollowTable.followerId, viewerId),
        eq(userFollowTable.followingId, postTable.authorId),
      ),
    )
    .$dynamic();

  const postEdges = (
    postCursorCondition
      ? postEdgesBase.where(postCursorCondition)
      : postEdgesBase
  )
    .orderBy(desc(postTable.createdAt), desc(postTable.id))
    .limit(FEED_PAGE_SIZE + 1)
    .as("following_post_edges");

  const repostEdgesBase = db
    .select({
      kind: sql<string>`'repost'`.as("kind"),
      kindPriority: sql<number>`1`.as("kindPriority"),
      edgeId: sql<string>`${postRepostTable.id}`.as("edge_id"),
      createdAt: postRepostTable.createdAt,
      postId: sql<string>`${postRepostTable.postId}`.as("post_id"),
      authorId: postTable.authorId,
      reposterId: sql<string | null>`${postRepostTable.userId}`.as(
        "reposter_id",
      ),
      repostContent: sql<string | null>`${postRepostTable.content}`.as(
        "repost_content",
      ),
    })
    .from(postRepostTable)
    .innerJoin(postTable, eq(postRepostTable.postId, postTable.id))
    .innerJoin(
      userFollowTable,
      and(
        eq(userFollowTable.followerId, viewerId),
        eq(userFollowTable.followingId, postRepostTable.userId),
      ),
    )
    .$dynamic();

  const repostEdges = (
    repostCursorCondition
      ? repostEdgesBase.where(repostCursorCondition)
      : repostEdgesBase
  )
    .orderBy(desc(postRepostTable.createdAt), desc(postRepostTable.id))
    .limit(FEED_PAGE_SIZE + 1)
    .as("following_repost_edges");

  const feedEdges = unionAll(
    db.select().from(postEdges),
    db.select().from(repostEdges),
  ).as("following_feed_edges");
  const edgeRows = await db
    .select()
    .from(feedEdges)
    .orderBy(
      desc(feedEdges.createdAt),
      desc(feedEdges.kindPriority),
      desc(feedEdges.edgeId),
    )
    .limit(FEED_PAGE_SIZE + 1);

  const { hasMore, pageRows } = getPageRows(
    edgeRows as FeedEdgeRow[],
    FEED_PAGE_SIZE,
  );
  const postIds = Array.from(new Set(pageRows.map((edge) => edge.postId)));
  const userIds = Array.from(
    new Set(
      pageRows.flatMap(
        (edge) => [edge.authorId, edge.reposterId].filter(Boolean) as string[],
      ),
    ),
  );

  const [posts, users] = await Promise.all([
    postIds.length > 0
      ? db.select().from(postTable).where(inArray(postTable.id, postIds))
      : [],
    userIds.length > 0
      ? db
          .select(publicUserColumns)
          .from(userTable)
          .where(inArray(userTable.id, userIds))
      : [],
  ]);

  const postMap = new Map(posts.map((post) => [post.id, post] as const));
  const userMap = new Map(users.map((user) => [user.id, user] as const));
  const data: FeedItem[] = pageRows.flatMap<FeedItem>((edge) => {
    const post = postMap.get(edge.postId);
    const author = userMap.get(edge.authorId);

    if (!post || !author) {
      return [];
    }

    const feedPost = {
      ...post,
      author,
      isLiked: false,
      isReposted: false,
    };

    if (edge.kind === "post") {
      return [{ type: "post" as const, post: feedPost }];
    }

    const reposter = edge.reposterId ? userMap.get(edge.reposterId) : null;

    if (!reposter) {
      return [];
    }

    return [
      {
        type: "repost" as const,
        post: feedPost,
        repost: {
          id: edge.edgeId,
          postId: edge.postId,
          content: edge.repostContent ?? undefined,
          createdAt: edge.createdAt,
          user: reposter,
        },
      },
    ];
  });

  return {
    data,
    nextCursor: hasMore
      ? getFeedNextCursor(pageRows[pageRows.length - 1])
      : null,
  };
}

// Extracts the stable id arrays the viewer-overlay cache key depends on. Sorted
// + deduped so the same SET of posts/actors yields the same key regardless of
// feed order.
function feedOverlayIds(items: FeedItem[]) {
  const postIds = Array.from(
    new Set(items.map((item) => item.post.id).filter(Boolean)),
  ).sort();
  const actorIds = Array.from(
    new Set(
      items.flatMap((item) =>
        item.type === "post"
          ? [item.post.author.id]
          : [item.post.author.id, item.repost.user.id],
      ),
    ),
  ).sort();

  return { postIds, actorIds };
}

// Keyed on the viewer + the sorted id arrays the caller extracts — NOT the full
// FeedItem[]. Passing whole items churned the cache key on every like/comment
// count change and the 120s public revalidate, so this "cached" overlay re-ran
// its 3 Turso queries on nearly every authenticated request.
async function getPostFeedViewerOverlay(
  viewerId: string,
  postIds: string[],
  actorIds: string[],
) {
  "use cache";
  cacheTag(`user-blocks:${viewerId}`);

  for (const postId of postIds) {
    cacheTag(`post:${postId}:liked:${viewerId}`);
    cacheTag(`post:${postId}:reposted:${viewerId}`);
  }

  cacheLife({ revalidate: PRIVATE_REVALIDATE_SECONDS });

  const [likedRows, repostRows, blockRows] = await Promise.all([
    postIds.length > 0
      ? db
          .select({ postId: postLikeTable.postId })
          .from(postLikeTable)
          .where(
            and(
              eq(postLikeTable.userId, viewerId),
              inArray(postLikeTable.postId, postIds),
            ),
          )
      : [],
    postIds.length > 0
      ? db
          .select({ postId: postRepostTable.postId })
          .from(postRepostTable)
          .where(
            and(
              eq(postRepostTable.userId, viewerId),
              inArray(postRepostTable.postId, postIds),
            ),
          )
      : [],
    actorIds.length > 0
      ? db
          .select({
            blockerId: userBlockTable.blockerId,
            blockedId: userBlockTable.blockedId,
          })
          .from(userBlockTable)
          .where(
            or(
              and(
                eq(userBlockTable.blockerId, viewerId),
                inArray(userBlockTable.blockedId, actorIds),
              ),
              and(
                inArray(userBlockTable.blockerId, actorIds),
                eq(userBlockTable.blockedId, viewerId),
              ),
            ),
          )
      : [],
  ]);

  return {
    blockedUserIds: new Set(
      blockRows.flatMap((row) =>
        row.blockerId === viewerId ? [row.blockedId] : [row.blockerId],
      ),
    ),
    likedPostIds: new Set(likedRows.map((row) => row.postId)),
    repostedPostIds: new Set(repostRows.map((row) => row.postId)),
  };
}

function applyPostFeedViewerOverlay(
  items: FeedItem[],
  overlay: Awaited<ReturnType<typeof getPostFeedViewerOverlay>>,
): FeedItem[] {
  return items.flatMap((item) => {
    const isAuthorBlocked = overlay.blockedUserIds.has(item.post.author.id);
    const isReposterBlocked =
      item.type === "repost" && overlay.blockedUserIds.has(item.repost.user.id);

    if (isAuthorBlocked || isReposterBlocked) {
      return [];
    }

    return [
      {
        ...item,
        post: {
          ...item.post,
          isLiked: overlay.likedPostIds.has(item.post.id),
          isReposted: overlay.repostedPostIds.has(item.post.id),
        },
      },
    ];
  });
}

export async function getPostsPage(params: {
  cursor?: string | null;
  sort?: FeedSort;
  viewerId?: string | null;
}): Promise<FeedResponse> {
  const publicData =
    params.sort === "following" && params.viewerId
      ? await getFollowingPostsPage(params.viewerId, params.cursor ?? null)
      : params.sort === "latest"
        ? await getPublicLatestPostsPage(params.cursor ?? null)
        : await getPublicHotPostsPage(
            params.cursor ?? null,
            getHotFeedRankedAtMs(params.cursor ?? null),
          );

  if (!params.viewerId) {
    return publicData;
  }

  const { postIds, actorIds } = feedOverlayIds(publicData.data);
  const overlay = await getPostFeedViewerOverlay(
    params.viewerId,
    postIds,
    actorIds,
  );

  return {
    ...publicData,
    // Preserve the shared public page window; viewer overlays may shorten it.
    data: applyPostFeedViewerOverlay(publicData.data, overlay),
  };
}

async function getPublicUserPostsPage(
  authorId: string,
  cursor: string | null,
): Promise<FeedResponse> {
  "use cache";
  cacheTag(`user-posts:${authorId}`);
  cacheLife({ revalidate: PUBLIC_REVALIDATE_SECONDS });

  const parsedCursor = parseCursor(cursor);
  const cursorCondition = parsedCursor
    ? or(
        lt(postTable.createdAt, parsedCursor.cursorDate),
        and(
          eq(postTable.createdAt, parsedCursor.cursorDate),
          lt(postTable.id, parsedCursor.cursorId),
        ),
      )
    : undefined;

  const baseCondition = eq(postTable.authorId, authorId);
  const whereCondition = cursorCondition
    ? and(baseCondition, cursorCondition)
    : baseCondition;

  // Keyset pagination on post_author_created_at_idx (author_id, created_at, id).
  const rows = await db
    .select({ post: postTable, author: publicUserColumns })
    .from(postTable)
    .innerJoin(userTable, eq(postTable.authorId, userTable.id))
    .where(whereCondition)
    .orderBy(desc(postTable.createdAt), desc(postTable.id))
    .limit(FEED_PAGE_SIZE + 1);

  const data: FeedItem[] = rows.flatMap(({ post, author }) => {
    if (!author) {
      return [];
    }

    return [
      {
        type: "post" as const,
        post: { ...post, author, isLiked: false, isReposted: false },
      },
    ];
  });

  const { hasMore, pageRows } = getPageRows(data, FEED_PAGE_SIZE);
  const lastItem = pageRows[pageRows.length - 1];

  return {
    data: pageRows,
    nextCursor:
      hasMore && lastItem
        ? `${lastItem.post.createdAt.getTime()}.${lastItem.post.id}`
        : null,
  };
}

export async function getUserPostsPage(params: {
  authorId: string;
  cursor?: string | null;
  viewerId?: string | null;
}): Promise<FeedResponse> {
  const publicData = await getPublicUserPostsPage(
    params.authorId,
    params.cursor ?? null,
  );

  if (!params.viewerId) {
    return publicData;
  }

  const { postIds, actorIds } = feedOverlayIds(publicData.data);
  const overlay = await getPostFeedViewerOverlay(
    params.viewerId,
    postIds,
    actorIds,
  );

  return {
    ...publicData,
    // Preserve the shared public page window; viewer overlays may shorten it.
    data: applyPostFeedViewerOverlay(publicData.data, overlay),
  };
}

async function getPublicPost(postId: string): Promise<PostResponse> {
  "use cache";
  cacheTag(`post:${postId}`);
  cacheLife({ revalidate: PUBLIC_REVALIDATE_SECONDS });

  const post = await db.query.postTable.findFirst({
    with: {
      author: true,
    },
    where: eq(postTable.id, postId),
  });

  if (!post?.author) {
    return null;
  }

  return {
    ...post,
    author: post.author as PublicUser,
    isLiked: false,
    isReposted: false,
  };
}

async function getPostViewerOverlay(
  viewerId: string,
  postId: string,
  authorId: string,
) {
  "use cache";
  cacheTag(`user-blocks:${viewerId}`);
  cacheTag(`post:${postId}:liked:${viewerId}`);
  cacheTag(`post:${postId}:reposted:${viewerId}`);
  cacheLife({ revalidate: PRIVATE_REVALIDATE_SECONDS });

  const [blockRows, likedRows, repostRows] = await Promise.all([
    db
      .select({
        blockerId: userBlockTable.blockerId,
        blockedId: userBlockTable.blockedId,
      })
      .from(userBlockTable)
      .where(
        or(
          and(
            eq(userBlockTable.blockerId, viewerId),
            eq(userBlockTable.blockedId, authorId),
          ),
          and(
            eq(userBlockTable.blockerId, authorId),
            eq(userBlockTable.blockedId, viewerId),
          ),
        ),
      ),
    db
      .select({ postId: postLikeTable.postId })
      .from(postLikeTable)
      .where(
        and(
          eq(postLikeTable.postId, postId),
          eq(postLikeTable.userId, viewerId),
        ),
      ),
    db
      .select({ postId: postRepostTable.postId })
      .from(postRepostTable)
      .where(
        and(
          eq(postRepostTable.postId, postId),
          eq(postRepostTable.userId, viewerId),
        ),
      ),
  ]);

  return {
    isBlocked: blockRows.length > 0,
    isLiked: likedRows.length > 0,
    isReposted: repostRows.length > 0,
  };
}

export async function getPostById(params: {
  postId: string;
  viewerId?: string | null;
}): Promise<PostResponse> {
  const publicPost = await getPublicPost(params.postId);

  if (!publicPost || !params.viewerId) {
    return publicPost;
  }

  const overlay = await getPostViewerOverlay(
    params.viewerId,
    params.postId,
    publicPost.author.id,
  );

  if (overlay.isBlocked) {
    return null;
  }

  return {
    ...publicPost,
    isLiked: overlay.isLiked,
    isReposted: overlay.isReposted,
  };
}

async function getPublicCommentsPage(
  postId: string,
  cursor: string | null,
): Promise<CommentsResponse> {
  "use cache";
  cacheTag(`post-comments:${postId}`);
  cacheLife({ revalidate: PUBLIC_REVALIDATE_SECONDS });

  const parsedCursor = parseCursor(cursor);

  const cursorCondition = parsedCursor
    ? or(
        lt(postCommentTable.createdAt, parsedCursor.cursorDate),
        and(
          eq(postCommentTable.createdAt, parsedCursor.cursorDate),
          lt(postCommentTable.id, parsedCursor.cursorId),
        ),
      )
    : undefined;

  const baseCondition = cursorCondition
    ? and(eq(postCommentTable.postId, postId), cursorCondition)
    : eq(postCommentTable.postId, postId);

  const rows = await db
    .select({
      comment: postCommentTable,
      author: publicUserColumns,
    })
    .from(postCommentTable)
    .leftJoin(userTable, eq(postCommentTable.authorId, userTable.id))
    .where(baseCondition)
    .orderBy(desc(postCommentTable.createdAt), desc(postCommentTable.id))
    .limit(COMMENTS_PAGE_SIZE + 1);

  const data: CommentData[] = rows.flatMap(({ comment, author }) => {
    if (!author) {
      return [];
    }

    return [
      {
        ...comment,
        author,
        isLiked: false,
      },
    ];
  });

  const { hasMore, pageRows } = getPageRows(data, COMMENTS_PAGE_SIZE);
  const lastItem = pageRows[pageRows.length - 1];

  return {
    data: pageRows,
    nextCursor:
      hasMore && lastItem
        ? `${lastItem.createdAt.getTime()}.${lastItem.id}`
        : null,
  };
}

// See feedOverlayIds: sorted + deduped so the cache key is stable across the
// public revalidate and other viewers' churn.
function commentOverlayIds(comments: CommentData[]) {
  const commentIds = Array.from(
    new Set(comments.map((comment) => comment.id)),
  ).sort();
  const authorIds = Array.from(
    new Set(comments.map((comment) => comment.author.id)),
  ).sort();

  return { commentIds, authorIds };
}

// Keyed on the viewer + sorted id arrays, NOT the full CommentData[] (see
// getPostFeedViewerOverlay), so the per-viewer overlay actually hits cache.
async function getCommentViewerOverlay(
  viewerId: string,
  commentIds: string[],
  authorIds: string[],
) {
  "use cache";
  cacheTag(`user-blocks:${viewerId}`);

  for (const commentId of commentIds) {
    cacheTag(`comment:${commentId}:liked:${viewerId}`);
  }

  cacheLife({ revalidate: PRIVATE_REVALIDATE_SECONDS });

  const [likedRows, blockRows] = await Promise.all([
    commentIds.length > 0
      ? db
          .select({ commentId: postCommentLikeTable.commentId })
          .from(postCommentLikeTable)
          .where(
            and(
              eq(postCommentLikeTable.userId, viewerId),
              inArray(postCommentLikeTable.commentId, commentIds),
            ),
          )
      : [],
    authorIds.length > 0
      ? db
          .select({
            blockerId: userBlockTable.blockerId,
            blockedId: userBlockTable.blockedId,
          })
          .from(userBlockTable)
          .where(
            or(
              and(
                eq(userBlockTable.blockerId, viewerId),
                inArray(userBlockTable.blockedId, authorIds),
              ),
              and(
                inArray(userBlockTable.blockerId, authorIds),
                eq(userBlockTable.blockedId, viewerId),
              ),
            ),
          )
      : [],
  ]);

  return {
    blockedUserIds: new Set(
      blockRows.flatMap((row) =>
        row.blockerId === viewerId ? [row.blockedId] : [row.blockerId],
      ),
    ),
    likedCommentIds: new Set(likedRows.map((row) => row.commentId)),
  };
}

export async function getPostCommentsPage(params: {
  postId: string;
  cursor?: string | null;
  viewerId?: string | null;
}): Promise<CommentsResponse> {
  const publicData = await getPublicCommentsPage(
    params.postId,
    params.cursor ?? null,
  );

  if (!params.viewerId) {
    return publicData;
  }

  const { commentIds, authorIds } = commentOverlayIds(publicData.data);
  const overlay = await getCommentViewerOverlay(
    params.viewerId,
    commentIds,
    authorIds,
  );

  return {
    ...publicData,
    // Preserve the shared public page window; viewer overlays may shorten it.
    data: publicData.data.flatMap((comment) => {
      if (overlay.blockedUserIds.has(comment.author.id)) {
        return [];
      }

      return [
        {
          ...comment,
          isLiked: overlay.likedCommentIds.has(comment.id),
        },
      ];
    }),
  };
}

async function getPublicNotesPage(
  cursor: string | null,
): Promise<NotesResponse> {
  "use cache";
  cacheTag("notes");
  cacheLife({ revalidate: PUBLIC_REVALIDATE_SECONDS });

  const parsedCursor = parseCursor(cursor);

  const cursorCondition = parsedCursor
    ? or(
        lt(noteTable.updatedAt, parsedCursor.cursorDate),
        and(
          eq(noteTable.updatedAt, parsedCursor.cursorDate),
          lt(noteTable.id, parsedCursor.cursorId),
        ),
      )
    : undefined;

  const baseQuery = db
    .select({
      note: noteTable,
      user: publicUserColumns,
    })
    .from(noteTable)
    .leftJoin(userTable, eq(noteTable.userId, userTable.id))
    .orderBy(desc(noteTable.updatedAt), desc(noteTable.id))
    .limit(FEED_PAGE_SIZE + 1);

  const rows = await (cursorCondition
    ? baseQuery.where(cursorCondition)
    : baseQuery);

  const data = rows.map(({ note, user }) =>
    note.isAnonymous
      ? ({ ...note } as NoteItem)
      : ({
          ...note,
          user: user ?? undefined,
        } as NoteItem),
  );

  const { hasMore, pageRows } = getPageRows(data, FEED_PAGE_SIZE);
  const lastItem = pageRows[pageRows.length - 1];

  return {
    data: pageRows,
    nextCursor:
      hasMore && lastItem
        ? `${(lastItem.updatedAt ?? lastItem.createdAt).getTime()}.${lastItem.id}`
        : null,
  };
}

// Keyed on the viewer + sorted authorIds/noteIds (see getPostFeedViewerOverlay),
// NOT the full NoteItem[], so the per-viewer overlay actually hits cache.
async function getNoteViewerOverlay(
  viewerId: string,
  authorIds: string[],
  noteIds: string[],
) {
  "use cache";
  cacheTag(`user-blocks:${viewerId}`);
  for (const noteId of noteIds) {
    cacheTag(`note:${noteId}:reacted:${viewerId}`);
  }
  cacheLife({ revalidate: PRIVATE_REVALIDATE_SECONDS });

  const [blockRows, reactedRows] = await Promise.all([
    authorIds.length > 0
      ? db
          .select({
            blockerId: userBlockTable.blockerId,
            blockedId: userBlockTable.blockedId,
          })
          .from(userBlockTable)
          .where(
            or(
              and(
                eq(userBlockTable.blockerId, viewerId),
                inArray(userBlockTable.blockedId, authorIds),
              ),
              and(
                inArray(userBlockTable.blockerId, authorIds),
                eq(userBlockTable.blockedId, viewerId),
              ),
            ),
          )
      : [],
    noteIds.length > 0
      ? db
          .select({ noteId: noteReactionTable.noteId })
          .from(noteReactionTable)
          .where(
            and(
              eq(noteReactionTable.userId, viewerId),
              inArray(noteReactionTable.noteId, noteIds),
            ),
          )
      : [],
  ]);

  return {
    blockedUserIds: new Set(
      blockRows.flatMap((row) =>
        row.blockerId === viewerId ? [row.blockedId] : [row.blockerId],
      ),
    ),
    reactedNoteIds: new Set(reactedRows.map((row) => row.noteId)),
  };
}

export async function getNotesPage(params: {
  cursor?: string | null;
  viewerId?: string | null;
}): Promise<NotesResponse> {
  const publicData = await getPublicNotesPage(params.cursor ?? null);

  if (!params.viewerId) {
    return publicData;
  }

  const authorIds = Array.from(
    new Set(
      publicData.data.flatMap((note) => (note.user?.id ? [note.user.id] : [])),
    ),
  ).sort();
  // From note.id, not author presence — anonymous notes are reactable too.
  const noteIds = publicData.data.map((note) => note.id).sort();
  const overlay = await getNoteViewerOverlay(
    params.viewerId,
    authorIds,
    noteIds,
  );

  return {
    ...publicData,
    // Preserve the shared public page window; viewer overlays may shorten it.
    data: publicData.data.flatMap((note) =>
      note.user?.id && overlay.blockedUserIds.has(note.user.id)
        ? []
        : [{ ...note, isReacted: overlay.reactedNoteIds.has(note.id) }],
    ),
  };
}

export async function getCurrentNoteData(userId: string) {
  const getCachedData = async () => {
    "use cache";
    cacheTag(`current-note:${userId}`);
    cacheLife({ revalidate: PRIVATE_REVALIDATE_SECONDS });

    const [data] = await db
      .select()
      .from(noteTable)
      .where(eq(noteTable.userId, userId))
      .limit(1);

    return data ?? null;
  };

  return getCachedData();
}

export async function getCurrentUserData(
  userId: string,
): Promise<CurrentUserResponse> {
  const getUserRecord = async () => {
    "use cache";
    cacheTag(`user:${userId}`);
    cacheLife({ revalidate: PRIVATE_REVALIDATE_SECONDS });

    const [userRecord] = await db
      .select({
        ...publicUserColumns,
        hasPassword:
          sql<number>`CASE WHEN ${userTable.passwordHash} IS NOT NULL THEN 1 ELSE 0 END`.as(
            "hasPassword",
          ),
      })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    return userRecord;
  };

  const getAccounts = async () => {
    "use cache";
    cacheTag(`user:${userId}:accounts`);
    cacheLife({ revalidate: PRIVATE_REVALIDATE_SECONDS });

    return db
      .select()
      .from(accountTable)
      .where(eq(accountTable.userId, userId));
  };

  // Independent cached reads — run concurrently to halve cold-cache latency on
  // /api/me (hit on nearly every authenticated page).
  const [userRecord, accounts] = await Promise.all([
    getUserRecord(),
    getAccounts(),
  ]);

  if (!userRecord) {
    return {};
  }

  return {
    user: {
      ...(userRecord as Omit<CurrentUserClient, "hasPassword">),
      hasPassword: Boolean(userRecord.hasPassword),
      accounts,
    },
  };
}

export async function getPublicUserProfileData(
  username: string,
): Promise<UserProfileResponse> {
  "use cache";
  cacheTag(`user:${username}`);
  cacheLife({ revalidate: 604800 });

  const [user] = await db
    .select({
      id: userTable.id,
      username: userTable.username,
      displayName: userTable.displayName,
      imageUrl: userTable.imageUrl,
      bio: userTable.bio,
      question: userTable.question,
      quietMode: userTable.quietMode,
      followerCount: userTable.followerCount,
      followingCount: userTable.followingCount,
      createdAt: userTable.createdAt,
      updatedAt: userTable.updatedAt,
    })
    .from(userTable)
    .where(eq(userTable.username, username))
    .limit(1);

  return user ?? null;
}

async function getUserProfileViewerOverlay(
  viewerId: string,
  username: string,
  targetId: string,
) {
  "use cache";
  cacheTag(`user:${username}:followed:${viewerId}`);
  cacheTag(`user:${username}:blocked:${viewerId}`);
  cacheTag(`user:${username}:blocked-by:${viewerId}`);
  cacheLife({ revalidate: PRIVATE_REVALIDATE_SECONDS });

  // Fold the three exists() probes into one round-trip (was three) — runs on
  // every cache-missed authenticated profile view.
  const [row] = await db
    .select({
      isFollowing: exists(
        db
          .select({ id: userFollowTable.id })
          .from(userFollowTable)
          .where(
            and(
              eq(userFollowTable.followerId, viewerId),
              eq(userFollowTable.followingId, targetId),
            ),
          ),
      ),
      isBlocked: exists(
        db
          .select({ id: userBlockTable.id })
          .from(userBlockTable)
          .where(
            and(
              eq(userBlockTable.blockerId, viewerId),
              eq(userBlockTable.blockedId, targetId),
            ),
          ),
      ),
      isBlockedBy: exists(
        db
          .select({ id: userBlockTable.id })
          .from(userBlockTable)
          .where(
            and(
              eq(userBlockTable.blockerId, targetId),
              eq(userBlockTable.blockedId, viewerId),
            ),
          ),
      ),
    })
    .from(userTable)
    .where(eq(userTable.id, targetId))
    .limit(1);

  return {
    isFollowing: Boolean(row?.isFollowing),
    isBlocked: Boolean(row?.isBlocked),
    isBlockedBy: Boolean(row?.isBlockedBy),
  };
}

export async function getUserProfileViewerData(
  username: string,
  viewerId?: string | null,
): Promise<UserProfileViewerResponse | null> {
  const user = await getPublicUserProfileData(username);

  if (!user) {
    return null;
  }

  if (!viewerId) {
    return {
      currentUserId: null,
      isAuthenticated: false,
      isFollowing: false,
      isBlocked: false,
      isBlockedBy: false,
    };
  }

  const overlay = await getUserProfileViewerOverlay(
    viewerId,
    username,
    user.id,
  );

  return {
    currentUserId: viewerId,
    isAuthenticated: true,
    ...overlay,
  };
}

export async function getUserProfileData(
  username: string,
  viewerId?: string | null,
) {
  const user = await getPublicUserProfileData(username);

  if (!user || !viewerId) {
    return user;
  }

  const overlay = await getUserProfileViewerData(username, viewerId);

  return {
    ...user,
    ...(overlay ?? {}),
  };
}

type FollowDirection = "followers" | "following";

// Keyset-paginated on the existing (anchor_id, created_at) indexes — a cache
// miss reads ~PAGE_SIZE follow rows + one batched user fetch, not a full scan.
async function getPublicFollowListPage(
  userId: string,
  cursor: string | null,
  direction: FollowDirection,
): Promise<{ users: PublicUser[]; nextCursor: string | null }> {
  "use cache";
  cacheTag(
    direction === "followers"
      ? `user-followers:${userId}`
      : `user-following:${userId}`,
  );
  cacheLife({ revalidate: PUBLIC_REVALIDATE_SECONDS });

  // followers list: page over rows where this user is *followed*, surface the
  // follower as the listed user. following list: the mirror image.
  const anchorColumn =
    direction === "followers"
      ? userFollowTable.followingId
      : userFollowTable.followerId;
  const listedColumn =
    direction === "followers"
      ? userFollowTable.followerId
      : userFollowTable.followingId;

  const parsedCursor = parseCursor(cursor);
  const cursorCondition = parsedCursor
    ? or(
        lt(userFollowTable.createdAt, parsedCursor.cursorDate),
        and(
          eq(userFollowTable.createdAt, parsedCursor.cursorDate),
          lt(userFollowTable.id, parsedCursor.cursorId),
        ),
      )
    : undefined;

  const baseCondition = eq(anchorColumn, userId);
  const whereCondition = cursorCondition
    ? and(baseCondition, cursorCondition)
    : baseCondition;

  const edgeRows = await db
    .select({
      id: userFollowTable.id,
      createdAt: userFollowTable.createdAt,
      listedUserId: listedColumn,
    })
    .from(userFollowTable)
    .where(whereCondition)
    .orderBy(desc(userFollowTable.createdAt), desc(userFollowTable.id))
    .limit(FOLLOW_LIST_PAGE_SIZE + 1);

  const { hasMore, pageRows } = getPageRows(edgeRows, FOLLOW_LIST_PAGE_SIZE);
  const listedIds = pageRows.map((row) => row.listedUserId);

  const users =
    listedIds.length > 0
      ? await db
          .select(publicUserColumns)
          .from(userTable)
          .where(inArray(userTable.id, listedIds))
      : [];

  // Preserve the follow-edge order (newest first); a missing user row (e.g. a
  // mid-flight delete) just drops out.
  const userMap = new Map(users.map((user) => [user.id, user] as const));
  const orderedUsers = pageRows.flatMap((row) => {
    const user = userMap.get(row.listedUserId);
    return user ? [user] : [];
  });

  const lastEdge = pageRows[pageRows.length - 1];

  return {
    users: orderedUsers,
    nextCursor:
      hasMore && lastEdge
        ? `${lastEdge.createdAt.getTime()}.${lastEdge.id}`
        : null,
  };
}

// Per-viewer overlay; keyed on (viewerId, sorted ids) and refreshed via the
// viewer's user-following / user-blocks tags (see getPostFeedViewerOverlay).
async function getFollowListViewerOverlay(
  viewerId: string,
  listedUserIds: string[],
) {
  "use cache";
  cacheTag(`user-following:${viewerId}`);
  cacheTag(`user-blocks:${viewerId}`);
  cacheLife({ revalidate: PRIVATE_REVALIDATE_SECONDS });

  const [followRows, blockRows] =
    listedUserIds.length > 0
      ? await Promise.all([
          db
            .select({ followingId: userFollowTable.followingId })
            .from(userFollowTable)
            .where(
              and(
                eq(userFollowTable.followerId, viewerId),
                inArray(userFollowTable.followingId, listedUserIds),
              ),
            ),
          db
            .select({
              blockerId: userBlockTable.blockerId,
              blockedId: userBlockTable.blockedId,
            })
            .from(userBlockTable)
            .where(
              or(
                and(
                  eq(userBlockTable.blockerId, viewerId),
                  inArray(userBlockTable.blockedId, listedUserIds),
                ),
                and(
                  inArray(userBlockTable.blockerId, listedUserIds),
                  eq(userBlockTable.blockedId, viewerId),
                ),
              ),
            ),
        ])
      : [[], []];

  return {
    followingIds: new Set(followRows.map((row) => row.followingId)),
    blockedUserIds: new Set(
      blockRows.flatMap((row) =>
        row.blockerId === viewerId ? [row.blockedId] : [row.blockerId],
      ),
    ),
  };
}

export async function getFollowListPage(params: {
  userId: string;
  direction: FollowDirection;
  cursor?: string | null;
  viewerId?: string | null;
}): Promise<FollowListResponse> {
  const publicData = await getPublicFollowListPage(
    params.userId,
    params.cursor ?? null,
    params.direction,
  );

  if (!params.viewerId) {
    return {
      data: publicData.users.map((user) => ({ ...user, isFollowing: false })),
      nextCursor: publicData.nextCursor,
      viewerId: null,
    };
  }

  const listedIds = Array.from(
    new Set(publicData.users.map((user) => user.id)),
  ).sort();
  const overlay = await getFollowListViewerOverlay(params.viewerId, listedIds);

  return {
    // Preserve the shared public page window; blocked users drop out.
    data: publicData.users.flatMap((user) =>
      overlay.blockedUserIds.has(user.id)
        ? []
        : [{ ...user, isFollowing: overlay.followingIds.has(user.id) }],
    ),
    nextCursor: publicData.nextCursor,
    viewerId: params.viewerId,
  };
}

export async function getMessagesPage(params: {
  type: "received" | "sent";
  cursor?: string | null;
  userId: string;
}): Promise<MessagesResponse> {
  const getCachedData = async () => {
    "use cache";
    cacheTag(`messages:${params.type}:${params.userId}`);
    cacheTag(`user-blocks:${params.userId}`);
    cacheLife({ revalidate: PRIVATE_REVALIDATE_SECONDS });

    const parsedCursor = parseCursor(params.cursor ?? null);

    const cursorCondition = parsedCursor
      ? or(
          lt(messageTable.createdAt, parsedCursor.cursorDate),
          and(
            eq(messageTable.createdAt, parsedCursor.cursorDate),
            lt(messageTable.id, parsedCursor.cursorId),
          ),
        )
      : undefined;

    const messageId =
      params.type === "received"
        ? messageTable.receiverId
        : messageTable.senderId;

    const baseCondition = eq(messageId, params.userId);
    const blockedCondition =
      params.type === "received"
        ? or(
            isNull(messageTable.senderId),
            and(
              not(
                exists(
                  db
                    .select({ id: userBlockTable.id })
                    .from(userBlockTable)
                    .where(
                      and(
                        eq(userBlockTable.blockerId, params.userId),
                        eq(userBlockTable.blockedId, messageTable.senderId),
                      ),
                    ),
                ),
              ),
              not(
                exists(
                  db
                    .select({ id: userBlockTable.id })
                    .from(userBlockTable)
                    .where(
                      and(
                        eq(userBlockTable.blockerId, messageTable.senderId),
                        eq(userBlockTable.blockedId, params.userId),
                      ),
                    ),
                ),
              ),
            ),
          )
        : and(
            not(
              exists(
                db
                  .select({ id: userBlockTable.id })
                  .from(userBlockTable)
                  .where(
                    and(
                      eq(userBlockTable.blockerId, params.userId),
                      eq(userBlockTable.blockedId, messageTable.receiverId),
                    ),
                  ),
              ),
            ),
            not(
              exists(
                db
                  .select({ id: userBlockTable.id })
                  .from(userBlockTable)
                  .where(
                    and(
                      eq(userBlockTable.blockerId, messageTable.receiverId),
                      eq(userBlockTable.blockedId, params.userId),
                    ),
                  ),
              ),
            ),
          );

    const whereCondition = cursorCondition
      ? and(cursorCondition, and(baseCondition, blockedCondition))
      : and(baseCondition, blockedCondition);

    const rows = await db
      .select({
        message: messageTable,
        receiver: publicUserColumns,
      })
      .from(messageTable)
      .innerJoin(userTable, eq(messageTable.receiverId, userTable.id))
      .where(whereCondition)
      .orderBy(desc(messageTable.createdAt), desc(messageTable.id))
      .limit(MESSAGES_PAGE_SIZE + 1);

    const data = rows
      .filter((row) => row.receiver !== null)
      .map(({ message, receiver }) => ({
        ...message,
        receiver,
      }));

    const { hasMore, pageRows } = getPageRows(data, MESSAGES_PAGE_SIZE);
    return {
      messages: pageRows,
      nextCursor:
        hasMore && pageRows.length > 0
          ? `${pageRows[pageRows.length - 1].createdAt?.getTime()}.${
              pageRows[pageRows.length - 1].id
            }`
          : null,
    };
  };

  const cachedData = await getCachedData();
  const isReceived = params.type === "received";
  const messages = await Promise.all(
    cachedData.messages.map(async (message) => {
      let content = message.content;
      let reply = message.reply ?? null;

      try {
        content = await aesDecrypt(message.content);
      } catch {}

      if (message.reply) {
        try {
          reply = await aesDecrypt(message.reply);
        } catch {
          reply = message.reply;
        }
      }

      if (isReceived) {
        // Never expose the (logged-in) sender's account id to the recipient —
        // returning it de-anonymizes every "anonymous" sender. Overwrite it to
        // null and carry only whether a block is possible; blocking resolves the
        // sender server-side from the message id. [audit #22]
        return {
          ...message,
          senderId: null,
          canBlock: message.senderId != null,
          content,
          reply,
        };
      }

      return {
        ...message,
        content,
        reply,
      };
    }),
  );

  return {
    ...cachedData,
    messages,
  };
}
