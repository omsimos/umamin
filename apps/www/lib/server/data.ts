import "server-only";

import { db } from "@umamin/db";
import {
  groupMemberTable,
  groupPendingTable,
  groupTable,
} from "@umamin/db/schema/group";
import { messageTable } from "@umamin/db/schema/message";
import { noteReactionTable, noteTable } from "@umamin/db/schema/note";
import { notificationTable } from "@umamin/db/schema/notification";
import {
  pollOptionTable,
  pollVoteTable,
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
  asc,
  desc,
  eq,
  exists,
  gt,
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
import {
  GROUP_TAG_LENGTH,
  JOINED_GROUPS_CAP,
  normalizeGroupTag,
} from "@/lib/group";
import type {
  BlockedUsersResponse,
  CommentsResponse,
  CurrentUserResponse,
  FeedResponse,
  FollowListResponse,
  GroupMembersResponse,
  GroupPageData,
  GroupRelationship,
  GroupRequestsResponse,
  MessagesResponse,
  NoteItem,
  NotesResponse,
  NotificationBadgeResponse,
  NotificationsResponse,
  PostResponse,
  UserGroupsResponse,
  UserProfileResponse,
  UserProfileViewerResponse,
} from "@/lib/query-types";
import { parseCursor } from "@/lib/server/cursor";
import {
  getRedisHotPostIdsPage,
  isRedisHotCursor,
} from "@/lib/server/feed-rank";
import { diversifyHotCandidates, getHotScoreKey } from "@/lib/server/hot-score";
import { countUnseen } from "@/lib/server/notifications";
import type { GroupBadgeData } from "@/types/group";
import type {
  CommentData,
  FeedItem,
  PollData,
  PollOptionData,
  QuotedPostData,
} from "@/types/post";
import type { CurrentUserClient, PublicUserWithBadge } from "@/types/user";

const PUBLIC_REVALIDATE_SECONDS = 120;
const PRIVATE_REVALIDATE_SECONDS = 30;
// 20 matches comments/messages and the virtualized above-the-fold (overscan 5);
// 40 over-fetched ~2x the rows + payload per page on a per-row-billed DB.
const FEED_PAGE_SIZE = 20;
const HOT_FEED_CANDIDATE_SIZE = 100;
const COMMENTS_PAGE_SIZE = 20;
const MESSAGES_PAGE_SIZE = 20;
const FOLLOW_LIST_PAGE_SIZE = 20;
const GROUP_MEMBERS_PAGE_SIZE = 20;
const NOTIFICATIONS_PAGE_SIZE = 20;
// The badge displays "9+" past nine — scanning further buys nothing.
const NOTIFICATION_BADGE_LIMIT = 10;

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
  pinnedPostId: userTable.pinnedPostId,
  equippedGroupId: userTable.equippedGroupId,
  followerCount: userTable.followerCount,
  followingCount: userTable.followingCount,
  createdAt: userTable.createdAt,
  updatedAt: userTable.updatedAt,
};

/**
 * Resolves the equipped group badges for a page of already-fetched users: one
 * bounded inArray on the group PK, only when someone on the page wears a
 * badge (usually far fewer distinct groups than authors). Runs INSIDE the
 * callers' "use cache" boundaries so the badge ships in the cached payload —
 * never a join on the feed union, never per-row lookups.
 */
async function getGroupBadgeMap(
  users: { equippedGroupId: string | null }[],
): Promise<Map<string, GroupBadgeData>> {
  const ids = Array.from(
    new Set(
      users.flatMap((user) =>
        user.equippedGroupId ? [user.equippedGroupId] : [],
      ),
    ),
  );

  if (ids.length === 0) {
    return new Map();
  }

  const groups = await db
    .select({
      id: groupTable.id,
      tag: groupTable.tag,
      icon: groupTable.icon,
      accent: groupTable.accent,
    })
    .from(groupTable)
    .where(inArray(groupTable.id, ids));

  return new Map(groups.map((group) => [group.id, group] as const));
}

// A dangling equippedGroupId (deleted group — soft ref) resolves to null and
// renders no badge, the same husk degradation as quoted posts.
function withGroupBadge<U extends { equippedGroupId: string | null }>(
  user: U,
  badgeMap: Map<string, GroupBadgeData>,
): U & { groupBadge: GroupBadgeData | null } {
  return {
    ...user,
    groupBadge: user.equippedGroupId
      ? (badgeMap.get(user.equippedGroupId) ?? null)
      : null,
  };
}

/**
 * Resolves the quoted posts embedded in a page of posts: one bounded inArray
 * read for the quoted rows + one for their authors, and only when the page
 * actually contains quotes. A quoted id that resolves to nothing (deleted
 * post) is simply absent from the map — callers render the husk.
 */
async function getQuotedPostMap(
  posts: Pick<SelectPost, "quotedPostId">[],
): Promise<Map<string, QuotedPostData>> {
  const ids = Array.from(
    new Set(
      posts.flatMap((post) => (post.quotedPostId ? [post.quotedPostId] : [])),
    ),
  );

  if (ids.length === 0) {
    return new Map();
  }

  const quoted = await db
    .select()
    .from(postTable)
    .where(inArray(postTable.id, ids));
  const authorIds = Array.from(new Set(quoted.map((post) => post.authorId)));
  const authors =
    authorIds.length > 0
      ? await db
          .select(publicUserColumns)
          .from(userTable)
          .where(inArray(userTable.id, authorIds))
      : [];

  const authorMap = new Map(authors.map((author) => [author.id, author]));

  return new Map(
    quoted.flatMap((post) => {
      const author = authorMap.get(post.authorId);
      return author ? [[post.id, { ...post, author }] as const] : [];
    }),
  );
}

// `undefined` = not a quote; `null` = quote whose target is gone (husk).
function resolveQuotedPost(
  post: Pick<SelectPost, "quotedPostId">,
  quotedMap: Map<string, QuotedPostData>,
): QuotedPostData | null | undefined {
  if (!post.quotedPostId) return undefined;
  return quotedMap.get(post.quotedPostId) ?? null;
}

/**
 * Resolves poll options for a page of posts: one bounded inArray read, only
 * when the page actually contains polls (pollEndsAt set). Counts are the
 * denormalized voteCount column — eventually consistent in the shared feed
 * cache, same as likeCount. The viewer's own vote is overlay data, not here.
 */
async function getPollOptionsMap(
  posts: Pick<SelectPost, "id" | "pollEndsAt">[],
): Promise<Map<string, PollOptionData[]>> {
  const ids = Array.from(
    new Set(posts.flatMap((post) => (post.pollEndsAt ? [post.id] : []))),
  );

  if (ids.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      id: pollOptionTable.id,
      postId: pollOptionTable.postId,
      idx: pollOptionTable.idx,
      label: pollOptionTable.label,
      voteCount: pollOptionTable.voteCount,
    })
    .from(pollOptionTable)
    .where(inArray(pollOptionTable.postId, ids))
    .orderBy(asc(pollOptionTable.idx));

  const map = new Map<string, PollOptionData[]>();
  for (const { postId, ...option } of rows) {
    const list = map.get(postId);
    if (list) {
      list.push(option);
    } else {
      map.set(postId, [option]);
    }
  }

  return map;
}

// `undefined` = no poll; `null` = poll whose option rows are missing.
function resolvePoll(
  post: Pick<SelectPost, "id" | "pollEndsAt">,
  pollMap: Map<string, PollOptionData[]>,
): PollData | null | undefined {
  if (!post.pollEndsAt) return undefined;
  const options = pollMap.get(post.id);
  return options ? { endsAt: post.pollEndsAt, options } : null;
}

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

// No longer a scoring input (the Hot score is static — see hot-score.ts):
// rankedAtMs survives purely as the per-120s "use cache" key for the first
// page, then rides the cursor so later pages reuse the same cache window.
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

  const [quotedMap, pollMap, badgeMap] = await Promise.all([
    getQuotedPostMap(posts),
    getPollOptionsMap(posts),
    getGroupBadgeMap(users),
  ]);

  const postMap = new Map(posts.map((post) => [post.id, post] as const));
  const userMap = new Map(
    users.map((user) => [user.id, withGroupBadge(user, badgeMap)] as const),
  );
  const data: FeedItem[] = pageRows.flatMap<FeedItem>((edge) => {
    const post = postMap.get(edge.postId);
    const author = userMap.get(edge.authorId);

    if (!post || !author) {
      return [];
    }

    const feedPost = {
      ...post,
      author,
      quotedPost: resolveQuotedPost(post, quotedMap),
      poll: resolvePoll(post, pollMap),
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

  const [quotedMap, pollMap, badgeMap] = await Promise.all([
    getQuotedPostMap(posts),
    getPollOptionsMap(posts),
    getGroupBadgeMap(users),
  ]);

  const postMap = new Map(posts.map((post) => [post.id, post] as const));
  const userMap = new Map(
    users.map((user) => [user.id, withGroupBadge(user, badgeMap)] as const),
  );
  // scoreKeys recomputed from the hydrated counters (no extra Redis reads);
  // they can drift from a stale zset float only within this page, which at
  // worst nudges the same-author spacing below.
  const candidates = page.ids.flatMap((postId) => {
    const post = postMap.get(postId);
    return post ? [{ post, scoreKey: getHotScoreKey(post) }] : [];
  });
  const data: FeedItem[] = diversifyHotCandidates(candidates).flatMap<FeedItem>(
    ({ post }) => {
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
            quotedPost: resolveQuotedPost(post, quotedMap),
            poll: resolvePoll(post, pollMap),
            isLiked: false,
            isReposted: false,
          },
        },
      ];
    },
  );

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
      scoreKey: getHotScoreKey(post),
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

  const [quotedMap, pollMap, badgeMap] = await Promise.all([
    getQuotedPostMap(pageRows.map((candidate) => candidate.post)),
    getPollOptionsMap(pageRows.map((candidate) => candidate.post)),
    getGroupBadgeMap(users),
  ]);

  const userMap = new Map(
    users.map((user) => [user.id, withGroupBadge(user, badgeMap)] as const),
  );
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
          quotedPost: resolveQuotedPost(post, quotedMap),
          poll: resolvePoll(post, pollMap),
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

  const [quotedMap, pollMap, badgeMap] = await Promise.all([
    getQuotedPostMap(posts),
    getPollOptionsMap(posts),
    getGroupBadgeMap(users),
  ]);

  const postMap = new Map(posts.map((post) => [post.id, post] as const));
  const userMap = new Map(
    users.map((user) => [user.id, withGroupBadge(user, badgeMap)] as const),
  );
  const data: FeedItem[] = pageRows.flatMap<FeedItem>((edge) => {
    const post = postMap.get(edge.postId);
    const author = userMap.get(edge.authorId);

    if (!post || !author) {
      return [];
    }

    const feedPost = {
      ...post,
      author,
      quotedPost: resolveQuotedPost(post, quotedMap),
      poll: resolvePoll(post, pollMap),
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
      items.flatMap((item) => [
        item.post.author.id,
        // Quoted authors must be probed too, or a blocked user's content
        // would leak through the embedded card.
        ...(item.post.quotedPost ? [item.post.quotedPost.author.id] : []),
        ...(item.type === "repost" ? [item.repost.user.id] : []),
      ]),
    ),
  ).sort();
  // Deterministic subset of postIds, so passing it as an overlay arg doesn't
  // churn the cache key; lets the overlay tag + probe only poll posts.
  const pollPostIds = Array.from(
    new Set(items.flatMap((item) => (item.post.poll ? [item.post.id] : []))),
  ).sort();

  return { postIds, actorIds, pollPostIds };
}

// Keyed on the viewer + the sorted id arrays the caller extracts — NOT the full
// FeedItem[]. Passing whole items churned the cache key on every like/comment
// count change and the 120s public revalidate, so this "cached" overlay re-ran
// its 3 Turso queries on nearly every authenticated request.
async function getPostFeedViewerOverlay(
  viewerId: string,
  postIds: string[],
  actorIds: string[],
  pollPostIds: string[] = [],
) {
  "use cache";
  cacheTag(`user-blocks:${viewerId}`);

  for (const postId of postIds) {
    cacheTag(`post:${postId}:liked:${viewerId}`);
    cacheTag(`post:${postId}:reposted:${viewerId}`);
  }
  // Only poll posts — a poll-free post can never bust a poll-voted tag, so
  // registering it for every post would just inflate the tag set.
  for (const postId of pollPostIds) {
    cacheTag(`post:${postId}:poll-voted:${viewerId}`);
  }

  cacheLife({ revalidate: PRIVATE_REVALIDATE_SECONDS });

  const [likedRows, repostRows, blockRows, voteRows] = await Promise.all([
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
    pollPostIds.length > 0
      ? db
          .select({
            postId: pollVoteTable.postId,
            optionId: pollVoteTable.optionId,
          })
          .from(pollVoteTable)
          .where(
            and(
              eq(pollVoteTable.userId, viewerId),
              inArray(pollVoteTable.postId, pollPostIds),
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
    myVoteByPostId: new Map(
      voteRows.map((row) => [row.postId, row.optionId] as const),
    ),
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

    // A quoted post from a blocked user degrades to the "unavailable" husk
    // (matching what its own page shows the viewer) instead of leaking through
    // the embed.
    const quotedPost =
      item.post.quotedPost &&
      overlay.blockedUserIds.has(item.post.quotedPost.author.id)
        ? null
        : item.post.quotedPost;

    return [
      {
        ...item,
        post: {
          ...item.post,
          quotedPost,
          poll: item.post.poll
            ? {
                ...item.post.poll,
                myVoteOptionId:
                  overlay.myVoteByPostId.get(item.post.id) ?? null,
              }
            : item.post.poll,
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

  const { postIds, actorIds, pollPostIds } = feedOverlayIds(publicData.data);
  const overlay = await getPostFeedViewerOverlay(
    params.viewerId,
    postIds,
    actorIds,
    pollPostIds,
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

  // The author's pin surfaces above the chronological flow on the first page
  // and is removed from its natural slot on every page (two pk lookups, only
  // on cache miss and only when a pin exists).
  const [pinTarget] = await db
    .select({ pinnedPostId: userTable.pinnedPostId })
    .from(userTable)
    .where(eq(userTable.id, authorId))
    .limit(1);
  const pinnedPostId = pinTarget?.pinnedPostId ?? null;

  // Keyset pagination on post_author_created_at_idx (author_id, created_at, id).
  const rows = await db
    .select({ post: postTable, author: publicUserColumns })
    .from(postTable)
    .innerJoin(userTable, eq(postTable.authorId, userTable.id))
    .where(whereCondition)
    .orderBy(desc(postTable.createdAt), desc(postTable.id))
    .limit(FEED_PAGE_SIZE + 1);

  // The author guard makes a stale/corrupted pin id (e.g. of someone else's
  // post) render nothing instead of pinning foreign content.
  const [pinnedRow] =
    !cursor && pinnedPostId
      ? await db
          .select({ post: postTable, author: publicUserColumns })
          .from(postTable)
          .innerJoin(userTable, eq(postTable.authorId, userTable.id))
          .where(
            and(
              eq(postTable.id, pinnedPostId),
              eq(postTable.authorId, authorId),
            ),
          )
          .limit(1)
      : [];

  const pagePosts = [
    ...(pinnedRow ? [pinnedRow.post] : []),
    ...rows.map((row) => row.post),
  ];
  const [quotedMap, pollMap, badgeMap] = await Promise.all([
    getQuotedPostMap(pagePosts),
    getPollOptionsMap(pagePosts),
    getGroupBadgeMap([
      ...rows.map((row) => row.author),
      ...(pinnedRow ? [pinnedRow.author] : []),
    ]),
  ]);

  const toFeedItem = (
    row: (typeof rows)[number],
    isPinned?: boolean,
  ): FeedItem => ({
    type: "post" as const,
    post: {
      ...row.post,
      author: withGroupBadge(row.author, badgeMap),
      quotedPost: resolveQuotedPost(row.post, quotedMap),
      poll: resolvePoll(row.post, pollMap),
      isLiked: false,
      isReposted: false,
      ...(isPinned ? { isPinned: true } : {}),
    },
  });

  const data: FeedItem[] = rows.flatMap((row) =>
    row.author ? [toFeedItem(row)] : [],
  );

  // Cursor math runs on the raw window so pagination stays continuous even
  // when the pin sits at a page boundary; the pin is filtered afterwards.
  const { hasMore, pageRows } = getPageRows(data, FEED_PAGE_SIZE);
  const lastItem = pageRows[pageRows.length - 1];

  const chronological = pinnedPostId
    ? pageRows.filter((item) => item.post.id !== pinnedPostId)
    : pageRows;
  const finalRows = pinnedRow?.author
    ? [toFeedItem(pinnedRow, true), ...chronological]
    : chronological;

  return {
    data: finalRows,
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

  const { postIds, actorIds, pollPostIds } = feedOverlayIds(publicData.data);
  const overlay = await getPostFeedViewerOverlay(
    params.viewerId,
    postIds,
    actorIds,
    pollPostIds,
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

  // Explicit join over the relational `with: { author: true }`: the relation
  // selects every user column (passwordHash, blockedWords, ...) and a type
  // cast can't strip them at runtime — this payload is client-bound and
  // CDN-cached, so the author must be projected through publicUserColumns.
  const [row] = await db
    .select({ post: postTable, author: publicUserColumns })
    .from(postTable)
    .innerJoin(userTable, eq(postTable.authorId, userTable.id))
    .where(eq(postTable.id, postId))
    .limit(1);

  if (!row) {
    return null;
  }

  const [quotedMap, pollMap, badgeMap] = await Promise.all([
    getQuotedPostMap([row.post]),
    getPollOptionsMap([row.post]),
    getGroupBadgeMap([row.author]),
  ]);

  return {
    ...row.post,
    author: withGroupBadge(row.author, badgeMap),
    quotedPost: resolveQuotedPost(row.post, quotedMap),
    poll: resolvePoll(row.post, pollMap),
    isLiked: false,
    isReposted: false,
  };
}

async function getPostViewerOverlay(
  viewerId: string,
  postId: string,
  authorId: string,
  // Opt-in: this overlay doubles as the quoted-post block probe, which never
  // needs (or should pay for) a poll-vote read.
  hasPoll = false,
) {
  "use cache";
  cacheTag(`user-blocks:${viewerId}`);
  cacheTag(`post:${postId}:liked:${viewerId}`);
  cacheTag(`post:${postId}:reposted:${viewerId}`);
  if (hasPoll) {
    cacheTag(`post:${postId}:poll-voted:${viewerId}`);
  }
  cacheLife({ revalidate: PRIVATE_REVALIDATE_SECONDS });

  const [blockRows, likedRows, repostRows, voteRows] = await Promise.all([
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
    hasPoll
      ? db
          .select({ optionId: pollVoteTable.optionId })
          .from(pollVoteTable)
          .where(
            and(
              eq(pollVoteTable.postId, postId),
              eq(pollVoteTable.userId, viewerId),
            ),
          )
      : [],
  ]);

  return {
    isBlocked: blockRows.length > 0,
    isLiked: likedRows.length > 0,
    isReposted: repostRows.length > 0,
    myVoteOptionId: voteRows[0]?.optionId ?? null,
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
    !!publicPost.poll,
  );

  if (overlay.isBlocked) {
    return null;
  }

  // Same husk rule as the feed overlay: an embedded quote from a blocked user
  // must not leak content its own page would hide from this viewer. Reuses
  // the cached overlay probe keyed on the quoted (post, author) pair.
  let quotedPost = publicPost.quotedPost;
  if (quotedPost) {
    const quotedOverlay = await getPostViewerOverlay(
      params.viewerId,
      quotedPost.id,
      quotedPost.author.id,
    );
    if (quotedOverlay.isBlocked) {
      quotedPost = null;
    }
  }

  return {
    ...publicPost,
    quotedPost,
    poll: publicPost.poll
      ? { ...publicPost.poll, myVoteOptionId: overlay.myVoteOptionId }
      : publicPost.poll,
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

  const badgeMap = await getGroupBadgeMap(
    rows.flatMap((row) => (row.author ? [row.author] : [])),
  );

  const data: CommentData[] = rows.flatMap(({ comment, author }) => {
    if (!author) {
      return [];
    }

    return [
      {
        ...comment,
        author: withGroupBadge(author, badgeMap),
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

  // Anonymous notes never resolve a badge — identity stays suppressed.
  const badgeMap = await getGroupBadgeMap(
    rows.flatMap((row) =>
      !row.note.isAnonymous && row.user ? [row.user] : [],
    ),
  );

  const data = rows.map(({ note, user }) =>
    note.isAnonymous
      ? ({ ...note } as NoteItem)
      : ({
          ...note,
          user: user ? withGroupBadge(user, badgeMap) : undefined,
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
        // Owner-private (like hasPassword): this record is only ever served to
        // its own session — keep blockedWords out of publicUserColumns.
        blockedWords: userTable.blockedWords,
        hasPassword:
          sql<number>`CASE WHEN ${userTable.passwordHash} IS NOT NULL THEN 1 ELSE 0 END`.as(
            "hasPassword",
          ),
      })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    if (!userRecord) {
      return userRecord;
    }

    // Resolve the equipped badge from its own (cached) group row so the
    // viewer's own surfaces (notes card, inbox card, composer) show it.
    const groupBadge = userRecord.equippedGroupId
      ? await getGroupBadge(userRecord.equippedGroupId)
      : null;

    return { ...userRecord, groupBadge };
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
      pinnedPostId: userTable.pinnedPostId,
      equippedGroupId: userTable.equippedGroupId,
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

/**
 * Profile + resolved badge. The 7-day profile cache stores only the
 * equippedGroupId pointer; the badge text/icon comes from the group's own
 * 120s `group:{id}`-tagged entry, so a group edit/delete refreshes profiles
 * without touching the long-lived profile cache.
 */
export async function getPublicUserProfileWithBadge(
  username: string,
): Promise<UserProfileResponse> {
  const profile = await getPublicUserProfileData(username);

  if (!profile?.equippedGroupId) {
    return profile;
  }

  return {
    ...profile,
    groupBadge: await getGroupBadge(profile.equippedGroupId),
  };
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
): Promise<{ users: PublicUserWithBadge[]; nextCursor: string | null }> {
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

  // Equipped badges for the page — one bounded inArray on the group PK,
  // baked into this cached page (same pattern as the feed author batch).
  const badgeMap = await getGroupBadgeMap(users);

  // Preserve the follow-edge order (newest first); a missing user row (e.g. a
  // mid-flight delete) just drops out.
  const userMap = new Map(
    users.map((user) => [user.id, withGroupBadge(user, badgeMap)] as const),
  );
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

const BLOCKED_USERS_PAGE_SIZE = 20;

// Keyset-paginated on user_block_blocker_created_idx — a cache miss reads
// ~PAGE_SIZE block rows + one batched user fetch, not a full scan. Per-viewer
// private data; the user-blocks tag is already busted by block/unblock.
export async function getBlockedUsersPage(params: {
  viewerId: string;
  cursor?: string | null;
}): Promise<BlockedUsersResponse> {
  "use cache";
  cacheTag(`user-blocks:${params.viewerId}`);
  cacheLife({ revalidate: PRIVATE_REVALIDATE_SECONDS });

  const parsedCursor = parseCursor(params.cursor ?? null);
  const cursorCondition = parsedCursor
    ? or(
        lt(userBlockTable.createdAt, parsedCursor.cursorDate),
        and(
          eq(userBlockTable.createdAt, parsedCursor.cursorDate),
          lt(userBlockTable.id, parsedCursor.cursorId),
        ),
      )
    : undefined;

  const baseCondition = eq(userBlockTable.blockerId, params.viewerId);

  const edgeRows = await db
    .select({
      id: userBlockTable.id,
      createdAt: userBlockTable.createdAt,
      blockedId: userBlockTable.blockedId,
    })
    .from(userBlockTable)
    .where(
      cursorCondition ? and(baseCondition, cursorCondition) : baseCondition,
    )
    .orderBy(desc(userBlockTable.createdAt), desc(userBlockTable.id))
    .limit(BLOCKED_USERS_PAGE_SIZE + 1);

  const { hasMore, pageRows } = getPageRows(edgeRows, BLOCKED_USERS_PAGE_SIZE);
  const blockedIds = pageRows.map((row) => row.blockedId);

  const users =
    blockedIds.length > 0
      ? await db
          .select(publicUserColumns)
          .from(userTable)
          .where(inArray(userTable.id, blockedIds))
      : [];

  // Preserve the block-edge order (newest first); a missing user row (deleted
  // account) just drops out.
  const userMap = new Map(users.map((user) => [user.id, user] as const));
  const data = pageRows.flatMap((row) => {
    const user = userMap.get(row.blockedId);
    return user ? [{ ...user, blockedAt: row.createdAt }] : [];
  });

  const lastEdge = pageRows[pageRows.length - 1];

  return {
    data,
    nextCursor:
      hasMore && lastEdge
        ? `${lastEdge.createdAt.getTime()}.${lastEdge.id}`
        : null,
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
        // returning it de-anonymizes every "anonymous" sender. [audit #22]
        return {
          ...message,
          senderId: null,
          content,
          reply,
        };
      }

      return {
        ...message,
        // Opened state is the receiver's alone — stripping it here (not in the
        // UI) is what keeps senders from reading it off the wire.
        openedAt: null,
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

export async function getNotificationBadgeData(
  viewerId: string,
): Promise<NotificationBadgeResponse> {
  "use cache";
  // Deliberately NOT the list's `notifications:` tag: mark-seen changes only
  // the badge, and must not bust the list cache the page just populated.
  cacheTag(`notifications-badge:${viewerId}`);
  cacheLife({ revalidate: PRIVATE_REVALIDATE_SECONDS });

  // Two independent reads run together (async-parallel); the watermark filter
  // happens in JS over the bounded newest rows instead of SQL, so the user row
  // and the notification scan don't waterfall. Unseen rows are by definition
  // the newest (updatedAt > watermark), so filtering the top LIMIT rows counts
  // exactly min(unseen, LIMIT) — the UI caps at "9+" anyway.
  //
  // The watermark is read from the user row directly — getSession's copy can
  // be up to 60s stale (Redis session cache), which would resurrect the badge
  // right after mark-seen.
  const [viewerRows, latest] = await Promise.all([
    db
      .select({ lastSeenNotificationsAt: userTable.lastSeenNotificationsAt })
      .from(userTable)
      .where(eq(userTable.id, viewerId))
      .limit(1),
    db
      .select({ updatedAt: notificationTable.updatedAt })
      .from(notificationTable)
      .where(eq(notificationTable.recipientId, viewerId))
      .orderBy(desc(notificationTable.updatedAt), desc(notificationTable.id))
      .limit(NOTIFICATION_BADGE_LIMIT),
  ]);

  const viewer = viewerRows[0];

  if (!viewer) {
    return { unseen: 0 };
  }

  return { unseen: countUnseen(latest, viewer.lastSeenNotificationsAt) };
}

export async function getNotificationsPage(params: {
  viewerId: string;
  cursor?: string | null;
}): Promise<NotificationsResponse> {
  "use cache";
  cacheTag(`notifications:${params.viewerId}`);
  cacheLife({ revalidate: PRIVATE_REVALIDATE_SECONDS });

  const parsedCursor = parseCursor(params.cursor ?? null);

  // Cursor rides updatedAt (not createdAt): aggregation bumps rows back to the
  // top, matching the (recipientId, updatedAt, id) index order.
  const cursorCondition = parsedCursor
    ? or(
        lt(notificationTable.updatedAt, parsedCursor.cursorDate),
        and(
          eq(notificationTable.updatedAt, parsedCursor.cursorDate),
          lt(notificationTable.id, parsedCursor.cursorId),
        ),
      )
    : undefined;

  const baseCondition = eq(notificationTable.recipientId, params.viewerId);

  const rows = await db
    .select({
      id: notificationTable.id,
      type: notificationTable.type,
      targetId: notificationTable.targetId,
      count: notificationTable.count,
      preview: notificationTable.preview,
      updatedAt: notificationTable.updatedAt,
      actor: {
        username: userTable.username,
        displayName: userTable.displayName,
        imageUrl: userTable.imageUrl,
      },
    })
    .from(notificationTable)
    .leftJoin(userTable, eq(notificationTable.actorId, userTable.id))
    .where(
      cursorCondition ? and(baseCondition, cursorCondition) : baseCondition,
    )
    .orderBy(desc(notificationTable.updatedAt), desc(notificationTable.id))
    .limit(NOTIFICATIONS_PAGE_SIZE + 1);

  const { hasMore, pageRows } = getPageRows(rows, NOTIFICATIONS_PAGE_SIZE);
  const lastRow = pageRows[pageRows.length - 1];

  return {
    notifications: pageRows,
    nextCursor:
      hasMore && lastRow
        ? `${lastRow.updatedAt.getTime()}.${lastRow.id}`
        : null,
  };
}

/**
 * Badge data for a single group, cached under its own tag so a group edit or
 * delete refreshes it instantly (updateTag) — for surfaces whose own cache
 * outlives the group, like the 7-day profile page that only stores the
 * equippedGroupId pointer.
 */
export async function getGroupBadge(
  groupId: string,
): Promise<GroupBadgeData | null> {
  "use cache";
  cacheTag(`group:${groupId}`);
  cacheLife({ revalidate: PUBLIC_REVALIDATE_SECONDS });

  const [group] = await db
    .select({
      id: groupTable.id,
      tag: groupTable.tag,
      icon: groupTable.icon,
      accent: groupTable.accent,
    })
    .from(groupTable)
    .where(eq(groupTable.id, groupId))
    .limit(1);

  return group ?? null;
}

/**
 * Public group page meta (name/description/tag/icon/memberCount/creator) —
 * the roster stays members-only. Resolves a 4-char param as a (folded) tag
 * and anything longer as a group id (21-char nanoid) so notifications can
 * deep-link by id; tags are immutable, so the param→group mapping never
 * goes stale.
 */
export async function getGroupPageData(
  tagOrId: string,
): Promise<GroupPageData | null> {
  "use cache";
  cacheLife({ revalidate: PUBLIC_REVALIDATE_SECONDS });

  const condition =
    tagOrId.length === GROUP_TAG_LENGTH
      ? eq(groupTable.tagNorm, normalizeGroupTag(tagOrId))
      : eq(groupTable.id, tagOrId);

  const [row] = await db
    .select({
      id: groupTable.id,
      name: groupTable.name,
      description: groupTable.description,
      tag: groupTable.tag,
      icon: groupTable.icon,
      accent: groupTable.accent,
      memberCount: groupTable.memberCount,
      createdAt: groupTable.createdAt,
      creatorUsername: userTable.username,
      creatorDisplayName: userTable.displayName,
    })
    .from(groupTable)
    .leftJoin(userTable, eq(groupTable.creatorId, userTable.id))
    .where(condition)
    .limit(1);

  if (!row) {
    return null;
  }

  // Tagged with the resolved id so tag-keyed and id-keyed entries for the
  // same group invalidate together.
  cacheTag(`group:${row.id}`);

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    tag: row.tag,
    icon: row.icon,
    accent: row.accent,
    memberCount: row.memberCount,
    createdAt: row.createdAt,
    creator: row.creatorUsername
      ? { username: row.creatorUsername, displayName: row.creatorDisplayName }
      : null,
  };
}

/**
 * Roster page in founding order (the owner's row is the oldest). The payload
 * is viewer-independent and cached per group — the members-only gate is the
 * calling route's job, checked before this is returned.
 */
export async function getGroupMembersPage(
  groupId: string,
  cursor: string | null,
): Promise<GroupMembersResponse> {
  "use cache";
  cacheTag(`group-members:${groupId}`);
  cacheLife({ revalidate: PUBLIC_REVALIDATE_SECONDS });

  const parsedCursor = parseCursor(cursor);
  // Ascending keyset on group_member_group_created_idx — never a full-roster
  // scan.
  const cursorCondition = parsedCursor
    ? or(
        gt(groupMemberTable.createdAt, parsedCursor.cursorDate),
        and(
          eq(groupMemberTable.createdAt, parsedCursor.cursorDate),
          gt(groupMemberTable.id, parsedCursor.cursorId),
        ),
      )
    : undefined;

  const baseCondition = eq(groupMemberTable.groupId, groupId);

  const rows = await db
    .select({
      id: groupMemberTable.id,
      role: groupMemberTable.role,
      joinedAt: groupMemberTable.createdAt,
      user: publicUserColumns,
    })
    .from(groupMemberTable)
    .innerJoin(userTable, eq(groupMemberTable.userId, userTable.id))
    .where(
      cursorCondition ? and(baseCondition, cursorCondition) : baseCondition,
    )
    .orderBy(asc(groupMemberTable.createdAt), asc(groupMemberTable.id))
    .limit(GROUP_MEMBERS_PAGE_SIZE + 1);

  const { hasMore, pageRows } = getPageRows(rows, GROUP_MEMBERS_PAGE_SIZE);
  const lastRow = pageRows[pageRows.length - 1];

  return {
    data: pageRows,
    nextCursor:
      hasMore && lastRow ? `${lastRow.joinedAt.getTime()}.${lastRow.id}` : null,
  };
}

/**
 * The viewer's active memberships for the /groups hub + equip picker, bounded
 * by the joined-groups cap. Private per-user payload (no-store route).
 */
export async function getUserGroups(
  userId: string,
): Promise<UserGroupsResponse> {
  "use cache";
  cacheTag(`user-groups:${userId}`);
  cacheLife({ revalidate: PRIVATE_REVALIDATE_SECONDS });

  const rows = await db
    .select({
      role: groupMemberTable.role,
      joinedAt: groupMemberTable.createdAt,
      group: {
        id: groupTable.id,
        name: groupTable.name,
        tag: groupTable.tag,
        icon: groupTable.icon,
        accent: groupTable.accent,
        memberCount: groupTable.memberCount,
      },
    })
    .from(groupMemberTable)
    .innerJoin(groupTable, eq(groupMemberTable.groupId, groupTable.id))
    .where(eq(groupMemberTable.userId, userId))
    .orderBy(asc(groupMemberTable.createdAt))
    .limit(JOINED_GROUPS_CAP);

  return {
    data: rows.map((row) => ({
      group: row.group,
      role: row.role,
      joinedAt: row.joinedAt,
    })),
  };
}

/**
 * The viewer's relationship to a group — drives the page's CTA (join request
 * vs accept-invite vs owner controls) and the members-only roster gate.
 * "owner"/"member" come from group_member; "invited"/"requested" from
 * group_pending. Tagged on the viewer's user-groups (membership + pending
 * changes invalidate it) and the roster.
 */
export async function getGroupViewerRelationship(
  viewerId: string,
  groupId: string,
): Promise<GroupRelationship | null> {
  "use cache";
  cacheTag(`user-groups:${viewerId}`);
  cacheTag(`group-members:${groupId}`);
  cacheLife({ revalidate: PRIVATE_REVALIDATE_SECONDS });

  const [membership, pending] = await Promise.all([
    db
      .select({ role: groupMemberTable.role })
      .from(groupMemberTable)
      .where(
        and(
          eq(groupMemberTable.groupId, groupId),
          eq(groupMemberTable.userId, viewerId),
        ),
      )
      .limit(1),
    db
      .select({ kind: groupPendingTable.kind })
      .from(groupPendingTable)
      .where(
        and(
          eq(groupPendingTable.groupId, groupId),
          eq(groupPendingTable.userId, viewerId),
        ),
      )
      .limit(1),
  ]);

  if (membership[0]) {
    return membership[0].role;
  }
  if (pending[0]) {
    return pending[0].kind === "invite" ? "invited" : "requested";
  }
  return null;
}

/**
 * The creator's pending join-requests (kind="request" only — invites are
 * outbound and don't await the creator). Keyset-paginated on
 * group_pending_group_created_idx; the calling route enforces creator-only.
 */
export async function getGroupPendingRequestsPage(
  groupId: string,
  cursor: string | null,
): Promise<GroupRequestsResponse> {
  "use cache";
  cacheTag(`group-requests:${groupId}`);
  cacheLife({ revalidate: PRIVATE_REVALIDATE_SECONDS });

  const parsedCursor = parseCursor(cursor);
  const cursorCondition = parsedCursor
    ? or(
        gt(groupPendingTable.createdAt, parsedCursor.cursorDate),
        and(
          eq(groupPendingTable.createdAt, parsedCursor.cursorDate),
          gt(groupPendingTable.id, parsedCursor.cursorId),
        ),
      )
    : undefined;

  const baseCondition = and(
    eq(groupPendingTable.groupId, groupId),
    eq(groupPendingTable.kind, "request"),
  );

  const rows = await db
    .select({
      id: groupPendingTable.id,
      requestedAt: groupPendingTable.createdAt,
      user: publicUserColumns,
    })
    .from(groupPendingTable)
    .innerJoin(userTable, eq(groupPendingTable.userId, userTable.id))
    .where(
      cursorCondition ? and(baseCondition, cursorCondition) : baseCondition,
    )
    .orderBy(asc(groupPendingTable.createdAt), asc(groupPendingTable.id))
    .limit(GROUP_MEMBERS_PAGE_SIZE + 1);

  const { hasMore, pageRows } = getPageRows(rows, GROUP_MEMBERS_PAGE_SIZE);
  const lastRow = pageRows[pageRows.length - 1];

  return {
    data: pageRows,
    nextCursor:
      hasMore && lastRow
        ? `${lastRow.requestedAt.getTime()}.${lastRow.id}`
        : null,
  };
}
