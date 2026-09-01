import {
  groupMemberTable,
  groupPendingTable,
  groupTable,
} from "@umamin/db/schema/group";
import {
  groupMessageReactionTable,
  groupMessageReadTable,
  groupMessageTable,
} from "@umamin/db/schema/group-message";
import { messageReplyTable, messageTable } from "@umamin/db/schema/message";
import {
  noteReactionTable,
  noteTable,
  type SelectNote,
} from "@umamin/db/schema/note";
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
import type { FeedSort } from "../lib/feed-sort";
import {
  type MusicAttachment,
  resolveMusicAttachment,
  safeMusicThumbnail,
} from "../lib/music";
import type {
  BlockedUsersResponse,
  CommentData,
  CommentsResponse,
  CurrentUserClient,
  CurrentUserResponse,
  FeedAuthorWithBadge,
  FeedItem,
  FeedResponse,
  FollowListResponse,
  GroupBadgeData,
  GroupChatMessage,
  GroupChatReplyPreview,
  GroupChatResponse,
  GroupMembersResponse,
  GroupMessageReactionState,
  GroupMessageReactor,
  GroupPageData,
  GroupRelationship,
  GroupRequestsResponse,
  GroupUnreadState,
  MessagesResponse,
  MessageThreadResponse,
  NoteItem,
  NotesResponse,
  NotificationBadgeResponse,
  NotificationsResponse,
  PollData,
  PollOptionData,
  PostResponse,
  QuotedPostData,
  UserGroupsResponse,
  UserProfileResponse,
  UserProfileViewerResponse,
} from "../lib/types";
import { parseCursor } from "./cursor";
import type { Db } from "./db";
import { getRedisHotPostIdsPage, isRedisHotCursor } from "./feed-rank";
import {
  GROUP_MEMBER_CAP,
  GROUP_TAG_LENGTH,
  JOINED_GROUPS_CAP,
  normalizeGroupTag,
} from "./group";
import { diversifyHotCandidates, getHotScoreKey } from "./hot-score";
import { isModerator } from "./moderation";
import { countUnseen } from "./notifications";

// 180s (was 120s): public reads are eventually-consistent and every surface
// busts its per-entity tag on write, so this only governs passive-staleness /
// cold-cache recompute frequency — widening it trims function CPU at no
// freshness cost (the feed's "new posts" pill covers perceived latency).
const PUBLIC_REVALIDATE_SECONDS = 180;
// 20 matches comments/messages and the virtualized above-the-fold (overscan 5);
// 40 over-fetched ~2x the rows + payload per page on a per-row-billed DB.
const FEED_PAGE_SIZE = 20;
const HOT_FEED_CANDIDATE_SIZE = 100;
const COMMENTS_PAGE_SIZE = 20;
const MESSAGES_PAGE_SIZE = 20;
const FOLLOW_LIST_PAGE_SIZE = 20;
const GROUP_MEMBERS_PAGE_SIZE = 20;
const GROUP_CHAT_PAGE_SIZE = 30;
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
  points: userTable.points,
  proUntil: userTable.proUntil,
  createdAt: userTable.createdAt,
  updatedAt: userTable.updatedAt,
};

// Lean list-author projection — drops bio/question/follower+followingCount/
// updatedAt/pinnedPostId (none rendered on any list surface) to cut Fast Origin
// Transfer. createdAt + proUntil drive the avatar shine (hasPlusFeatures: Plus
// by age OR an active Pro) — the horizon rides the payload instead of a baked
// isPro flag so TTL-cached entries self-correct at render when Pro expires;
// equippedGroupId feeds withGroupBadge; points kept for forward-compat. The
// FULL publicUserColumns stays on the current-user + profile reads (which
// render bio/counts). Must match the FeedAuthor type in lib/types.ts (9 keys).
const feedAuthorColumns = {
  id: userTable.id,
  username: userTable.username,
  displayName: userTable.displayName,
  imageUrl: userTable.imageUrl,
  quietMode: userTable.quietMode,
  equippedGroupId: userTable.equippedGroupId,
  points: userTable.points,
  proUntil: userTable.proUntil,
  createdAt: userTable.createdAt,
};

/**
 * Resolves the equipped group badges for a page of already-fetched users: one
 * bounded inArray on the group PK, only when someone on the page wears a
 * badge (usually far fewer distinct groups than authors). Runs INSIDE the
 * callers' "use cache" boundaries so the badge ships in the cached payload —
 * never a join on the feed union, never per-row lookups.
 */
async function getGroupBadgeMap(
  db: Db,
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
 * read joined to their authors, and only when the page actually contains
 * quotes. A quoted id that resolves to nothing (deleted post, or an author row
 * that is gone) is simply absent from the map — callers render the husk.
 */
async function getQuotedPostMap(
  db: Db,
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
    .select({ post: postTable, author: feedAuthorColumns })
    .from(postTable)
    .innerJoin(userTable, eq(postTable.authorId, userTable.id))
    .where(inArray(postTable.id, ids));

  return new Map(
    quoted.map(
      (row) => [row.post.id, { ...row.post, author: row.author }] as const,
    ),
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
  db: Db,
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
  db: Db,
  cursor: string | null,
): Promise<FeedResponse> {
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
          .select(feedAuthorColumns)
          .from(userTable)
          .where(inArray(userTable.id, userIds))
      : [],
  ]);

  const [quotedMap, pollMap, badgeMap] = await Promise.all([
    getQuotedPostMap(db, posts),
    getPollOptionsMap(db, posts),
    getGroupBadgeMap(db, users),
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
  db: Db,
  kv: KVNamespace | undefined,
  cursor: string | null,
): Promise<FeedResponse | null> {
  const page = await getRedisHotPostIdsPage(
    kv,
    cursor,
    FEED_PAGE_SIZE,
    HOT_FEED_CANDIDATE_SIZE,
  );

  if (!page) {
    return null;
  }

  // The rank read above is served from the KV ranked-id list (recomputed by the
  // */5 cron), so ordering lags ≤5min and a post created since the last
  // recompute is absent until it runs. The hydration below is a direct Turso
  // read — the per-id-set "use cache" boundary is gone; public caching now
  // happens at the route level. The per-viewer overlay (blocks/likes/reposts)
  // is layered on by the caller.
  return {
    data: await hydrateHotPostIds(db, page.ids),
    nextCursor: page.nextCursor,
  };
}

async function hydrateHotPostIds(db: Db, ids: string[]): Promise<FeedItem[]> {
  const posts =
    ids.length > 0
      ? await db.select().from(postTable).where(inArray(postTable.id, ids))
      : [];
  const authorIds = Array.from(new Set(posts.map((post) => post.authorId)));
  const users =
    authorIds.length > 0
      ? await db
          .select(feedAuthorColumns)
          .from(userTable)
          .where(inArray(userTable.id, authorIds))
      : [];

  const [quotedMap, pollMap, badgeMap] = await Promise.all([
    getQuotedPostMap(db, posts),
    getPollOptionsMap(db, posts),
    getGroupBadgeMap(db, users),
  ]);

  const postMap = new Map(posts.map((post) => [post.id, post] as const));
  const userMap = new Map(
    users.map((user) => [user.id, withGroupBadge(user, badgeMap)] as const),
  );
  // scoreKeys recomputed from the hydrated counters (no extra Redis reads);
  // they can drift from a stale zset float only within this page, which at
  // worst nudges the same-author spacing below.
  const candidates = ids.flatMap((postId) => {
    const post = postMap.get(postId);
    return post ? [{ post, scoreKey: getHotScoreKey(post) }] : [];
  });
  return diversifyHotCandidates(candidates).flatMap<FeedItem>(({ post }) => {
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
}

async function getCachedPublicHotPostsPage(
  db: Db,
  cursor: string | null,
  rankedAtMs: number,
): Promise<FeedResponse> {
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
          .select(feedAuthorColumns)
          .from(userTable)
          .where(inArray(userTable.id, authorIds))
      : [];

  const [quotedMap, pollMap, badgeMap] = await Promise.all([
    getQuotedPostMap(
      db,
      pageRows.map((candidate) => candidate.post),
    ),
    getPollOptionsMap(
      db,
      pageRows.map((candidate) => candidate.post),
    ),
    getGroupBadgeMap(db, users),
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
  db: Db,
  kv: KVNamespace | undefined,
  cursor: string | null,
  rankedAtMs: number,
): Promise<FeedResponse> {
  const redisData =
    !cursor || isRedisHotCursor(cursor)
      ? await getRedisHotPostsPage(db, kv, cursor)
      : null;

  if (isRedisHotCursor(cursor)) {
    return redisData ?? { data: [], nextCursor: null };
  }

  return (
    redisData ?? (await getCachedPublicHotPostsPage(db, cursor, rankedAtMs))
  );
}

async function getFollowingPostsPage(
  db: Db,
  viewerId: string,
  cursor: string | null,
): Promise<FeedResponse> {
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
          .select(feedAuthorColumns)
          .from(userTable)
          .where(inArray(userTable.id, userIds))
      : [],
  ]);

  const [quotedMap, pollMap, badgeMap] = await Promise.all([
    getQuotedPostMap(db, posts),
    getPollOptionsMap(db, posts),
    getGroupBadgeMap(db, users),
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
  db: Db,
  viewerId: string,
  postIds: string[],
  actorIds: string[],
  pollPostIds: string[] = [],
) {
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

export async function getPostsPage(
  db: Db,
  kv: KVNamespace | undefined,
  params: {
    cursor?: string | null;
    sort?: FeedSort;
    viewerId?: string | null;
  },
): Promise<FeedResponse> {
  const publicData =
    params.sort === "following" && params.viewerId
      ? await getFollowingPostsPage(db, params.viewerId, params.cursor ?? null)
      : params.sort === "latest"
        ? await getPublicLatestPostsPage(db, params.cursor ?? null)
        : await getPublicHotPostsPage(
            db,
            kv,
            params.cursor ?? null,
            getHotFeedRankedAtMs(params.cursor ?? null),
          );

  if (!params.viewerId) {
    return publicData;
  }

  const { postIds, actorIds, pollPostIds } = feedOverlayIds(publicData.data);
  const overlay = await getPostFeedViewerOverlay(
    db,
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
  db: Db,
  authorId: string,
  cursor: string | null,
): Promise<FeedResponse> {
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

  // The author's pin surfaces above the chronological flow on the first page and
  // is removed from its natural slot on every page. The pin pointer is
  // independent of the page window, so it rides alongside it rather than ahead
  // of it; only the pinned ROW below has to wait on the id.
  const [[pinTarget], rows] = await Promise.all([
    db
      .select({ pinnedPostId: userTable.pinnedPostId })
      .from(userTable)
      .where(eq(userTable.id, authorId))
      .limit(1),
    // Keyset pagination on post_author_created_at_idx (author_id, created_at, id).
    db
      .select({ post: postTable, author: feedAuthorColumns })
      .from(postTable)
      .innerJoin(userTable, eq(postTable.authorId, userTable.id))
      .where(whereCondition)
      .orderBy(desc(postTable.createdAt), desc(postTable.id))
      .limit(FEED_PAGE_SIZE + 1),
  ]);
  const pinnedPostId = pinTarget?.pinnedPostId ?? null;

  // The author guard makes a stale/corrupted pin id (e.g. of someone else's
  // post) render nothing instead of pinning foreign content.
  const [pinnedRow] =
    !cursor && pinnedPostId
      ? await db
          .select({ post: postTable, author: feedAuthorColumns })
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
    getQuotedPostMap(db, pagePosts),
    getPollOptionsMap(db, pagePosts),
    getGroupBadgeMap(db, [
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

export async function getUserPostsPage(
  db: Db,
  params: {
    authorId: string;
    cursor?: string | null;
    viewerId?: string | null;
  },
): Promise<FeedResponse> {
  const publicData = await getPublicUserPostsPage(
    db,
    params.authorId,
    params.cursor ?? null,
  );

  if (!params.viewerId) {
    return publicData;
  }

  const { postIds, actorIds, pollPostIds } = feedOverlayIds(publicData.data);
  const overlay = await getPostFeedViewerOverlay(
    db,
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

async function getPublicPost(db: Db, postId: string): Promise<PostResponse> {
  // Explicit join over the relational `with: { author: true }`: the relation
  // selects every user column (passwordHash, blockedWords, ...) and a type
  // cast can't strip them at runtime — this payload is client-bound and
  // CDN-cached, so the author must be projected through feedAuthorColumns.
  const [row] = await db
    .select({ post: postTable, author: feedAuthorColumns })
    .from(postTable)
    .innerJoin(userTable, eq(postTable.authorId, userTable.id))
    .where(eq(postTable.id, postId))
    .limit(1);

  if (!row) {
    return null;
  }

  const [quotedMap, pollMap, badgeMap] = await Promise.all([
    getQuotedPostMap(db, [row.post]),
    getPollOptionsMap(db, [row.post]),
    getGroupBadgeMap(db, [row.author]),
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
  db: Db,
  viewerId: string,
  postId: string,
  // [0] is the post's own author; any extra ids (an embedded quote's author)
  // are probed for blocks in the SAME round trip rather than a second overlay.
  authorIds: string[],
  hasPoll: boolean,
) {
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
            inArray(userBlockTable.blockedId, authorIds),
          ),
          and(
            inArray(userBlockTable.blockerId, authorIds),
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

  // Both columns matter: the viewer is the blocker on one side of the `or` and
  // the blocked party on the other.
  const blockedAuthorIds = new Set(
    blockRows.map((row) =>
      row.blockerId === viewerId ? row.blockedId : row.blockerId,
    ),
  );
  const mainAuthorId = authorIds[0];

  return {
    isBlocked: mainAuthorId ? blockedAuthorIds.has(mainAuthorId) : false,
    blockedAuthorIds,
    isLiked: likedRows.length > 0,
    isReposted: repostRows.length > 0,
    myVoteOptionId: voteRows[0]?.optionId ?? null,
  };
}

export async function getPostById(
  db: Db,
  params: {
    postId: string;
    viewerId?: string | null;
  },
): Promise<PostResponse> {
  const publicPost = await getPublicPost(db, params.postId);

  if (!publicPost || !params.viewerId) {
    return publicPost;
  }

  // Same husk rule as the feed overlay: an embedded quote from a blocked user
  // must not leak content its own page would hide from this viewer. The quoted
  // author rides in the overlay's own block probe — a second overlay call would
  // chain three more reads it never looks at.
  const overlay = await getPostViewerOverlay(
    db,
    params.viewerId,
    params.postId,
    [
      publicPost.author.id,
      ...(publicPost.quotedPost ? [publicPost.quotedPost.author.id] : []),
    ],
    !!publicPost.poll,
  );

  if (overlay.isBlocked) {
    return null;
  }

  let quotedPost = publicPost.quotedPost;
  if (quotedPost && overlay.blockedAuthorIds.has(quotedPost.author.id)) {
    quotedPost = null;
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
  db: Db,
  postId: string,
  cursor: string | null,
): Promise<CommentsResponse> {
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
      author: feedAuthorColumns,
    })
    .from(postCommentTable)
    .leftJoin(userTable, eq(postCommentTable.authorId, userTable.id))
    .where(baseCondition)
    .orderBy(desc(postCommentTable.createdAt), desc(postCommentTable.id))
    .limit(COMMENTS_PAGE_SIZE + 1);

  const badgeMap = await getGroupBadgeMap(
    db,
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
  db: Db,
  viewerId: string,
  commentIds: string[],
  authorIds: string[],
) {
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

export async function getPostCommentsPage(
  db: Db,
  params: {
    postId: string;
    cursor?: string | null;
    viewerId?: string | null;
  },
): Promise<CommentsResponse> {
  const publicData = await getPublicCommentsPage(
    db,
    params.postId,
    params.cursor ?? null,
  );

  if (!params.viewerId) {
    return publicData;
  }

  const { commentIds, authorIds } = commentOverlayIds(publicData.data);
  const overlay = await getCommentViewerOverlay(
    db,
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

// Turns a raw note row into the client `music` object. The shared
// resolveMusicAttachment (lib/music.ts) handles the music_* columns and the
// thumbnail re-validation; this wrapper only adds the note-specific legacy
// spotify_* fallback.
//
// Precedence is legacy spotify_* FIRST during the 5.24.0 expand/contract
// transition: new code NULLS spotify_* on every save, so a non-null
// spotify_track_id reliably means OLD code wrote this note's song most recently
// (old code can't touch music_*). Once old code is retired every save nulls
// spotify_*, so notes converge to the music_* path; the later contract migration
// that drops spotify_* finalizes it.
function resolveNoteMusic(note: SelectNote): MusicAttachment | null {
  if (note.spotifyTrackId) {
    return {
      provider: "spotify",
      id: note.spotifyTrackId,
      title: note.spotifyTitle ?? null,
      thumbnail: safeMusicThumbnail("spotify", note.spotifyThumbnail),
    };
  }
  return resolveMusicAttachment(note);
}

// Emit the lean NoteItem: a single `music` object, with the raw music_*/legacy
// spotify_* columns dropped so they never ride the client payload.
function toNoteItem(
  note: SelectNote,
  extra?: Pick<NoteItem, "user" | "isReacted">,
): NoteItem {
  const {
    musicProvider: _mp,
    musicId: _mi,
    musicTitle: _mt,
    musicThumbnail: _mth,
    spotifyTrackId: _st,
    spotifyTitle: _stt,
    spotifyThumbnail: _sth,
    ...rest
  } = note;
  return { ...rest, music: resolveNoteMusic(note), ...extra };
}

async function getPublicNotesPage(
  db: Db,
  cursor: string | null,
): Promise<NotesResponse> {
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
      user: feedAuthorColumns,
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
    db,
    rows.flatMap((row) =>
      !row.note.isAnonymous && row.user ? [row.user] : [],
    ),
  );

  const data = rows.map(({ note, user }) =>
    note.isAnonymous
      ? toNoteItem(note)
      : toNoteItem(note, {
          user: user ? withGroupBadge(user, badgeMap) : undefined,
        }),
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
  db: Db,
  viewerId: string,
  authorIds: string[],
  noteIds: string[],
) {
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

export async function getNotesPage(
  db: Db,
  params: {
    cursor?: string | null;
    viewerId?: string | null;
  },
): Promise<NotesResponse> {
  const publicData = await getPublicNotesPage(db, params.cursor ?? null);

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
    db,
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

export async function getCurrentNoteData(
  db: Db,
  userId: string,
): Promise<NoteItem | null> {
  const getCachedData = async () => {
    const [data] = await db
      .select()
      .from(noteTable)
      .where(eq(noteTable.userId, userId))
      .limit(1);

    return data ?? null;
  };

  const data = await getCachedData();
  return data ? toNoteItem(data) : null;
}

export async function getCurrentUserData(
  db: Db,
  userId: string,
  // The moderator roster (env.MODERATOR_USERS) resolved at the call site — the
  // module-init env read is gone (see moderation.ts); the flag is still computed
  // per request so a roster change takes effect on the next request.
  moderatorUsers?: string | null,
): Promise<CurrentUserResponse> {
  const getUserRecord = async () => {
    const [userRecord] = await db
      .select({
        ...publicUserColumns,
        // Profile-header-only (kept out of publicUserColumns so author payloads
        // stay compact); included here so settings can preview the current one.
        bannerImageUrl: userTable.bannerImageUrl,
        // Pro theme preference, for the settings picker + own-profile render.
        profileTheme: userTable.profileTheme,
        // Owner-private (like hasPassword): this record is only ever served to
        // its own session — keep blockedWords out of publicUserColumns.
        blockedWords: userTable.blockedWords,
        // Owner-private push-notification preference bitmask (see types/user.ts).
        pushPrefs: userTable.pushPrefs,
        // Profile song (resolved into a lean `music` object below, raw columns
        // dropped) so settings can preview/edit the attached song.
        musicProvider: userTable.musicProvider,
        musicId: userTable.musicId,
        musicTitle: userTable.musicTitle,
        musicThumbnail: userTable.musicThumbnail,
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
      ? await getGroupBadge(db, userRecord.equippedGroupId)
      : null;

    // Drop the raw music_* columns and emit the lean `music` object (same
    // contract as the public profile read).
    const { musicProvider, musicId, musicTitle, musicThumbnail, ...rest } =
      userRecord;
    return {
      ...rest,
      groupBadge,
      music: resolveMusicAttachment({
        musicProvider,
        musicId,
        musicTitle,
        musicThumbnail,
      }),
    };
  };

  const getAccounts = async () => {
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
      isModerator: isModerator(
        { username: userRecord.username },
        moderatorUsers,
      ),
    },
  };
}

export async function getPublicUserProfileData(
  db: Db,
  username: string,
): Promise<UserProfileResponse> {
  const [user] = await db
    .select({
      id: userTable.id,
      username: userTable.username,
      displayName: userTable.displayName,
      imageUrl: userTable.imageUrl,
      bannerImageUrl: userTable.bannerImageUrl,
      bio: userTable.bio,
      question: userTable.question,
      quietMode: userTable.quietMode,
      pinnedPostId: userTable.pinnedPostId,
      equippedGroupId: userTable.equippedGroupId,
      followerCount: userTable.followerCount,
      followingCount: userTable.followingCount,
      points: userTable.points,
      proUntil: userTable.proUntil,
      profileTheme: userTable.profileTheme,
      createdAt: userTable.createdAt,
      updatedAt: userTable.updatedAt,
      musicProvider: userTable.musicProvider,
      musicId: userTable.musicId,
      musicTitle: userTable.musicTitle,
      musicThumbnail: userTable.musicThumbnail,
    })
    .from(userTable)
    .where(eq(userTable.username, username))
    .limit(1);

  if (!user) {
    return null;
  }

  // Drop the raw music_* columns and emit a single lean, re-validated `music`
  // object — the same contract as NoteItem.music (see resolveNoteMusic).
  const { musicProvider, musicId, musicTitle, musicThumbnail, ...rest } = user;
  return {
    ...rest,
    music: resolveMusicAttachment({
      musicProvider,
      musicId,
      musicTitle,
      musicThumbnail,
    }),
  };
}

/**
 * Profile + resolved badge. The 7-day profile cache stores only the
 * equippedGroupId pointer; the badge text/icon comes from the group's own
 * 120s `group:{id}`-tagged entry, so a group edit/delete refreshes profiles
 * without touching the long-lived profile cache.
 */
export async function getPublicUserProfileWithBadge(
  db: Db,
  username: string,
): Promise<UserProfileResponse> {
  const profile = await getPublicUserProfileData(db, username);

  if (!profile?.equippedGroupId) {
    return profile;
  }

  return {
    ...profile,
    groupBadge: await getGroupBadge(db, profile.equippedGroupId),
  };
}

async function getUserProfileViewerOverlay(
  db: Db,
  viewerId: string,
  targetId: string,
) {
  // Fold the three exists() probes into one round-trip (was three).
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

// Split out so a caller that already holds the profile row (getUserProfileData)
// doesn't pay a second, byte-identical read for it.
async function getUserProfileViewerDataForUser(
  db: Db,
  user: { id: string },
  viewerId?: string | null,
  opts?: { viewerIsModerator?: boolean },
): Promise<UserProfileViewerResponse> {
  if (!viewerId) {
    return {
      currentUserId: null,
      isAuthenticated: false,
      isFollowing: false,
      isBlocked: false,
      isBlockedBy: false,
      isBanned: false,
    };
  }

  const overlay = await getUserProfileViewerOverlay(db, viewerId, user.id);

  // Ban state is moderator-only and read FRESH (not cached) so a moderator sees
  // the current status immediately after a ban/unban. Non-moderators always get
  // false — ban state must never leak.
  let isBanned = false;
  if (opts?.viewerIsModerator) {
    const [row] = await db
      .select({ bannedAt: userTable.bannedAt })
      .from(userTable)
      .where(eq(userTable.id, user.id))
      .limit(1);
    isBanned = Boolean(row?.bannedAt);
  }

  return {
    currentUserId: viewerId,
    isAuthenticated: true,
    ...overlay,
    isBanned,
  };
}

export async function getUserProfileViewerData(
  db: Db,
  username: string,
  viewerId?: string | null,
  opts?: { viewerIsModerator?: boolean },
): Promise<UserProfileViewerResponse | null> {
  const user = await getPublicUserProfileData(db, username);

  if (!user) {
    return null;
  }

  return getUserProfileViewerDataForUser(db, user, viewerId, opts);
}

export async function getUserProfileData(
  db: Db,
  username: string,
  viewerId?: string | null,
) {
  const user = await getPublicUserProfileData(db, username);

  if (!user || !viewerId) {
    return user;
  }

  const overlay = await getUserProfileViewerDataForUser(db, user, viewerId);

  return {
    ...user,
    ...overlay,
  };
}

type FollowDirection = "followers" | "following";

// Keyset-paginated on the existing (anchor_id, created_at) indexes — a cache
// miss reads ~PAGE_SIZE follow rows + one batched user fetch, not a full scan.
async function getPublicFollowListPage(
  db: Db,
  userId: string,
  cursor: string | null,
  direction: FollowDirection,
): Promise<{ users: FeedAuthorWithBadge[]; nextCursor: string | null }> {
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
          .select(feedAuthorColumns)
          .from(userTable)
          .where(inArray(userTable.id, listedIds))
      : [];

  // Equipped badges for the page — one bounded inArray on the group PK,
  // baked into this cached page (same pattern as the feed author batch).
  const badgeMap = await getGroupBadgeMap(db, users);

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
  db: Db,
  viewerId: string,
  listedUserIds: string[],
) {
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

export async function getFollowListPage(
  db: Db,
  params: {
    userId: string;
    direction: FollowDirection;
    cursor?: string | null;
    viewerId?: string | null;
  },
): Promise<FollowListResponse> {
  const publicData = await getPublicFollowListPage(
    db,
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
  const overlay = await getFollowListViewerOverlay(
    db,
    params.viewerId,
    listedIds,
  );

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
export async function getBlockedUsersPage(
  db: Db,
  params: {
    viewerId: string;
    cursor?: string | null;
  },
): Promise<BlockedUsersResponse> {
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
          .select(feedAuthorColumns)
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

export async function getMessagesPage(
  db: Db,
  params: {
    type: "received" | "sent";
    cursor?: string | null;
    userId: string;
  },
): Promise<MessagesResponse> {
  const getCachedData = async () => {
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
        receiver: feedAuthorColumns,
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
          // Each side's read watermark is private to that side.
          senderReadAt: null,
          content,
          reply,
        };
      }

      return {
        ...message,
        // Opened state is the receiver's alone — stripping it here (not in the
        // UI) is what keeps senders from reading it off the wire.
        openedAt: null,
        receiverReadAt: null,
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

// Bounded, not paginated: a 1:1 correspondence stays short, and one LIMIT
// keeps the read a single round trip instead of a cursor waterfall.
const THREAD_REPLIES_LIMIT = 200;

export async function getMessageThread(
  db: Db,
  params: { messageId: string; viewerId: string },
): Promise<MessageThreadResponse | null> {
  // All three reads run together — the auth verdict only decides whether the
  // rows are returned, so nothing needs to waterfall (Tokyo round trips
  // dominate TTFB, not query cost).
  const [msgRows, replyRows, blockRows] = await Promise.all([
    db
      .select({ message: messageTable, receiver: feedAuthorColumns })
      .from(messageTable)
      .innerJoin(userTable, eq(messageTable.receiverId, userTable.id))
      .where(eq(messageTable.id, params.messageId))
      .limit(1),
    db
      .select({
        id: messageReplyTable.id,
        content: messageReplyTable.content,
        fromSender: messageReplyTable.fromSender,
        createdAt: messageReplyTable.createdAt,
      })
      .from(messageReplyTable)
      .where(eq(messageReplyTable.messageId, params.messageId))
      // rowid tiebreak, not id: createdAt is second-granularity and nanoids
      // aren't monotonic, so a same-second exchange would render scrambled.
      .orderBy(asc(messageReplyTable.createdAt), sql`rowid`)
      .limit(THREAD_REPLIES_LIMIT),
    // Pair-precise via the message row (PK seek + unique-index probes), not a
    // scan of every block involving the viewer — Turso bills rows scanned. A
    // NULL senderId matches nothing, so anonymous messages skip it naturally.
    db
      .select({ id: userBlockTable.id })
      .from(userBlockTable)
      .innerJoin(messageTable, eq(messageTable.id, params.messageId))
      .where(
        or(
          and(
            eq(userBlockTable.blockerId, messageTable.receiverId),
            eq(userBlockTable.blockedId, messageTable.senderId),
          ),
          and(
            eq(userBlockTable.blockerId, messageTable.senderId),
            eq(userBlockTable.blockedId, messageTable.receiverId),
          ),
        ),
      )
      .limit(1),
  ]);

  const row = msgRows[0];
  if (!row) return null;

  const { message, receiver } = row;
  const isReceiver = message.receiverId === params.viewerId;
  const isSender =
    message.senderId != null && message.senderId === params.viewerId;

  if (!isReceiver && !isSender) return null;

  // Blocked either way hides the thread, matching both list queries.
  if (blockRows.length > 0) {
    return null;
  }

  let content = message.content;
  try {
    content = await aesDecrypt(message.content);
  } catch {}

  let reply = message.reply ?? null;
  if (message.reply) {
    try {
      reply = await aesDecrypt(message.reply);
    } catch {
      reply = message.reply;
    }
  }

  const replies = await Promise.all(
    replyRows.map(async (entry) => {
      let entryContent = entry.content;
      try {
        entryContent = await aesDecrypt(entry.content);
      } catch {}
      return { ...entry, content: entryContent };
    }),
  );

  const shared = { ...message, content, reply, receiver };

  return {
    message: isReceiver
      ? // Never expose the (logged-in) sender's account id to the recipient —
        // returning it de-anonymizes every "anonymous" sender. [audit #22]
        { ...shared, senderId: null, senderReadAt: null }
      : // Opened state and the receiver's watermark are the receiver's alone.
        { ...shared, openedAt: null, receiverReadAt: null },
    replies,
    viewerRole: isReceiver ? "receiver" : "sender",
    threadable: message.senderId != null,
  };
}

export async function getNotificationBadgeData(
  db: Db,
  viewerId: string,
): Promise<NotificationBadgeResponse> {
  // Deliberately NOT the list's `notifications:` tag: mark-seen changes only
  // the badge, and must not bust the list cache the page just populated.

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

export async function getNotificationsPage(
  db: Db,
  params: {
    viewerId: string;
    cursor?: string | null;
  },
): Promise<NotificationsResponse> {
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

  // The seen watermark rides the first page (async-parallel, no waterfall) so
  // the client can mark which rows are new. Read from the user row directly —
  // getSession's copy can lag mark-seen (session cache).
  const [rows, viewerRows] = await Promise.all([
    db
      .select({
        id: notificationTable.id,
        type: notificationTable.type,
        targetId: notificationTable.targetId,
        count: notificationTable.count,
        preview: notificationTable.preview,
        updatedAt: notificationTable.updatedAt,
        actor: {
          // id feeds the default avatar (BlobatarFallback) — free here, it is
          // already the leftJoin key. Drizzle still nulls the whole nested
          // object when the actor is anonymous or the account is deleted.
          id: userTable.id,
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
      .limit(NOTIFICATIONS_PAGE_SIZE + 1),
    parsedCursor
      ? Promise.resolve([])
      : db
          .select({
            lastSeenNotificationsAt: userTable.lastSeenNotificationsAt,
          })
          .from(userTable)
          .where(eq(userTable.id, params.viewerId))
          .limit(1),
  ]);

  const { hasMore, pageRows } = getPageRows(rows, NOTIFICATIONS_PAGE_SIZE);
  const lastRow = pageRows[pageRows.length - 1];

  return {
    notifications: pageRows,
    nextCursor:
      hasMore && lastRow
        ? `${lastRow.updatedAt.getTime()}.${lastRow.id}`
        : null,
    ...(parsedCursor
      ? {}
      : {
          lastSeen: viewerRows[0]?.lastSeenNotificationsAt?.getTime() ?? 0,
        }),
  };
}

/**
 * Badge data for a single group, cached under its own tag so a group edit or
 * delete refreshes it instantly (updateTag) — for surfaces whose own cache
 * outlives the group, like the 7-day profile page that only stores the
 * equippedGroupId pointer.
 */
export async function getGroupBadge(
  db: Db,
  groupId: string,
): Promise<GroupBadgeData | null> {
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
  db: Db,
  tagOrId: string,
): Promise<GroupPageData | null> {
  const isTag = tagOrId.length === GROUP_TAG_LENGTH;
  const tagNorm = isTag ? normalizeGroupTag(tagOrId) : null;
  // Tag the lookup form up front so even a negative (no-match) result is
  // bustable — createGroupAction busts `group-tag:${tagNorm}`, so a 404 cached
  // before the group existed doesn't linger after it's created.

  const condition = tagNorm
    ? eq(groupTable.tagNorm, tagNorm)
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
  db: Db,
  groupId: string,
  cursor: string | null,
): Promise<GroupMembersResponse> {
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
      user: feedAuthorColumns,
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

// Compact author projection for chat bubbles — far smaller than
// publicUserColumns so the poll/delta payload (Fast Origin Transfer) stays
// lean. equippedGroupId feeds withGroupBadge.
const chatSenderColumns = {
  id: userTable.id,
  username: userTable.username,
  displayName: userTable.displayName,
  imageUrl: userTable.imageUrl,
  equippedGroupId: userTable.equippedGroupId,
};

const GROUP_REPLY_PREVIEW_MAX = 120;

type GroupMessageRow = {
  id: string;
  content: string;
  createdAt: Date;
  replyToMessageId: string | null;
  sender: {
    id: string;
    username: string;
    displayName: string | null;
    imageUrl: string | null;
    equippedGroupId: string | null;
  };
};

// Resolve badges + reply previews once per page (bounded inArray reads on the
// group PK) then decrypt each body. Shared by the cached history page and the
// uncached live delta. Reply previews are truncated server-side so the payload
// (Fast Origin Transfer) stays small.
async function toGroupChatMessages(
  db: Db,
  rows: GroupMessageRow[],
): Promise<GroupChatMessage[]> {
  const badgeMap = await getGroupBadgeMap(
    db,
    rows.map((row) => row.sender),
  );

  const parentIds = Array.from(
    new Set(
      rows.flatMap((row) =>
        row.replyToMessageId ? [row.replyToMessageId] : [],
      ),
    ),
  );

  const replyMap = new Map<string, GroupChatReplyPreview>();
  if (parentIds.length > 0) {
    const parents = await db
      .select({
        id: groupMessageTable.id,
        content: groupMessageTable.content,
        username: userTable.username,
        displayName: userTable.displayName,
      })
      .from(groupMessageTable)
      .innerJoin(userTable, eq(groupMessageTable.senderId, userTable.id))
      .where(inArray(groupMessageTable.id, parentIds));

    for (const parent of parents) {
      replyMap.set(parent.id, {
        id: parent.id,
        content: (await aesDecrypt(parent.content)).slice(
          0,
          GROUP_REPLY_PREVIEW_MAX,
        ),
        senderName: parent.displayName ?? parent.username,
      });
    }
  }

  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      content: await aesDecrypt(row.content),
      createdAt: row.createdAt,
      sender: withGroupBadge(row.sender, badgeMap),
      replyTo: row.replyToMessageId
        ? (replyMap.get(row.replyToMessageId) ?? null)
        : null,
    })),
  );
}

/**
 * Newest-first chat history (initial load + scroll-up via `cursor` = the
 * oldest loaded edge). Cached + busted by the send action's
 * `group-messages:${groupId}` updateTag, so the first page is read-your-writes
 * while older pages stay warm. The members-only gate is the calling route's
 * job. Keyset on group_message_group_created_id_idx — never a full-room SCAN.
 */
export async function getGroupMessagesPage(
  db: Db,
  groupId: string,
  cursor: string | null,
): Promise<GroupChatResponse> {
  const parsedCursor = parseCursor(cursor);
  const cursorCondition = parsedCursor
    ? or(
        lt(groupMessageTable.createdAt, parsedCursor.cursorDate),
        and(
          eq(groupMessageTable.createdAt, parsedCursor.cursorDate),
          lt(groupMessageTable.id, parsedCursor.cursorId),
        ),
      )
    : undefined;

  const baseCondition = eq(groupMessageTable.groupId, groupId);

  const rows = await db
    .select({
      id: groupMessageTable.id,
      content: groupMessageTable.content,
      createdAt: groupMessageTable.createdAt,
      replyToMessageId: groupMessageTable.replyToMessageId,
      sender: chatSenderColumns,
    })
    .from(groupMessageTable)
    .innerJoin(userTable, eq(groupMessageTable.senderId, userTable.id))
    .where(
      cursorCondition ? and(baseCondition, cursorCondition) : baseCondition,
    )
    .orderBy(desc(groupMessageTable.createdAt), desc(groupMessageTable.id))
    .limit(GROUP_CHAT_PAGE_SIZE + 1);

  const { hasMore, pageRows } = getPageRows(rows, GROUP_CHAT_PAGE_SIZE);
  const lastRow = pageRows[pageRows.length - 1];

  return {
    data: await toGroupChatMessages(db, pageRows),
    nextCursor:
      hasMore && lastRow
        ? `${lastRow.createdAt.getTime()}.${lastRow.id}`
        : null,
  };
}

/**
 * The live tail: messages strictly newer than `since` (the client's newest
 * loaded edge), oldest→newest so the client appends in order. Deliberately NOT
 * cached — the cursor churns every poll, so caching would never hit. Bounded
 * LIMIT keeps a backlog catch-up from unbounding the read; a full page implies
 * more, surfaced via nextCursor. A missing/empty cursor returns nothing (the
 * client always sends its newest before polling).
 */
export async function getGroupMessagesSince(
  db: Db,
  groupId: string,
  since: string | null,
): Promise<GroupChatResponse> {
  const parsedCursor = parseCursor(since);
  if (!parsedCursor) {
    return { data: [], nextCursor: null };
  }

  const rows = await db
    .select({
      id: groupMessageTable.id,
      content: groupMessageTable.content,
      createdAt: groupMessageTable.createdAt,
      replyToMessageId: groupMessageTable.replyToMessageId,
      sender: chatSenderColumns,
    })
    .from(groupMessageTable)
    .innerJoin(userTable, eq(groupMessageTable.senderId, userTable.id))
    .where(
      and(
        eq(groupMessageTable.groupId, groupId),
        or(
          gt(groupMessageTable.createdAt, parsedCursor.cursorDate),
          and(
            eq(groupMessageTable.createdAt, parsedCursor.cursorDate),
            gt(groupMessageTable.id, parsedCursor.cursorId),
          ),
        ),
      ),
    )
    .orderBy(asc(groupMessageTable.createdAt), asc(groupMessageTable.id))
    .limit(GROUP_CHAT_PAGE_SIZE + 1);

  const { hasMore, pageRows } = getPageRows(rows, GROUP_CHAT_PAGE_SIZE);
  const lastRow = pageRows[pageRows.length - 1];

  return {
    data: await toGroupChatMessages(db, pageRows),
    nextCursor:
      hasMore && lastRow
        ? `${lastRow.createdAt.getTime()}.${lastRow.id}`
        : null,
  };
}

/**
 * Per-group unread flags for the /groups hub dot. Two bounded reads over the
 * viewer's <=JOINED_GROUPS_CAP groups + their read watermarks — never a COUNT
 * or a message scan. `hasUnread` = the group has messages newer than the
 * viewer's last read. Cached per viewer; busted on mark-read (read-your-writes
 * when you open a room). A new message from someone else surfaces within the
 * revalidate window — eventual consistency is fine for a dot.
 */
export async function getGroupUnreadStates(
  db: Db,
  userId: string,
): Promise<GroupUnreadState[]> {
  const memberships = await db
    .select({
      groupId: groupMemberTable.groupId,
      lastMessageAt: groupTable.lastMessageAt,
      // Join time baselines a never-opened room so a new member isn't shown
      // unread for the entire pre-join back-history (already-indexed column).
      memberCreatedAt: groupMemberTable.createdAt,
    })
    .from(groupMemberTable)
    .innerJoin(groupTable, eq(groupMemberTable.groupId, groupTable.id))
    .where(eq(groupMemberTable.userId, userId))
    .limit(JOINED_GROUPS_CAP);

  if (memberships.length === 0) {
    return [];
  }

  const reads = await db
    .select({
      groupId: groupMessageReadTable.groupId,
      lastReadAt: groupMessageReadTable.lastReadAt,
    })
    .from(groupMessageReadTable)
    .where(
      and(
        eq(groupMessageReadTable.userId, userId),
        inArray(
          groupMessageReadTable.groupId,
          memberships.map((m) => m.groupId),
        ),
      ),
    );

  const readMap = new Map(reads.map((r) => [r.groupId, r.lastReadAt]));

  return memberships.map((m) => {
    // Fall back to join time when the member has never opened the room, so the
    // dot only reflects messages sent since they joined.
    const baseline = readMap.get(m.groupId) ?? m.memberCreatedAt;
    return {
      groupId: m.groupId,
      hasUnread:
        m.lastMessageAt != null &&
        (baseline == null || m.lastMessageAt.getTime() > baseline.getTime()),
    };
  });
}

// Cap on how many message ids a single reaction-overlay request resolves —
// bounds the read regardless of how far the client has scrolled.
const GROUP_REACTION_IDS_MAX = 80;

/**
 * Reaction overlay for a set of loaded messages: the aggregate emoji counts per
 * message + the viewer's own pick. NOT cached (per-viewer, and reads are the
 * abundant axis here). Bounded by the id cap; only messages that actually have
 * reactions are returned so the payload stays small. The join scopes to
 * `groupId` so a client can't read reaction counts for a message in another
 * group by passing a foreign id (IDOR) — the route only authorizes this group.
 */
export async function getGroupMessageReactions(
  db: Db,
  messageIds: string[],
  viewerId: string,
  groupId: string,
): Promise<GroupMessageReactionState[]> {
  const ids = messageIds.slice(0, GROUP_REACTION_IDS_MAX);
  if (ids.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      messageId: groupMessageReactionTable.messageId,
      emoji: groupMessageReactionTable.emoji,
      userId: groupMessageReactionTable.userId,
    })
    .from(groupMessageReactionTable)
    .innerJoin(
      groupMessageTable,
      eq(groupMessageReactionTable.messageId, groupMessageTable.id),
    )
    .where(
      and(
        inArray(groupMessageReactionTable.messageId, ids),
        eq(groupMessageTable.groupId, groupId),
      ),
    );

  const byMessage = new Map<
    string,
    { counts: Map<string, number>; viewer: string | null }
  >();

  for (const row of rows) {
    let entry = byMessage.get(row.messageId);
    if (!entry) {
      entry = { counts: new Map(), viewer: null };
      byMessage.set(row.messageId, entry);
    }
    entry.counts.set(row.emoji, (entry.counts.get(row.emoji) ?? 0) + 1);
    if (row.userId === viewerId) {
      entry.viewer = row.emoji;
    }
  }

  return Array.from(byMessage, ([messageId, entry]) => ({
    messageId,
    reactions: Array.from(entry.counts, ([emoji, count]) => ({ emoji, count })),
    viewerReaction: entry.viewer,
  }));
}

/**
 * The "who reacted" list for one message — each reactor + the emoji they used,
 * for the reactions drawer. Scoped to `groupId` (IDOR-safe) and bounded by the
 * member cap (one reaction per user, ≤ members).
 */
export async function getGroupMessageReactors(
  db: Db,
  messageId: string,
  groupId: string,
): Promise<GroupMessageReactor[]> {
  const rows = await db
    .select({
      emoji: groupMessageReactionTable.emoji,
      id: userTable.id,
      username: userTable.username,
      displayName: userTable.displayName,
      imageUrl: userTable.imageUrl,
    })
    .from(groupMessageReactionTable)
    .innerJoin(
      groupMessageTable,
      eq(groupMessageReactionTable.messageId, groupMessageTable.id),
    )
    .innerJoin(userTable, eq(groupMessageReactionTable.userId, userTable.id))
    .where(
      and(
        eq(groupMessageReactionTable.messageId, messageId),
        eq(groupMessageTable.groupId, groupId),
      ),
    )
    .orderBy(
      asc(groupMessageReactionTable.emoji),
      asc(groupMessageReactionTable.createdAt),
    )
    .limit(GROUP_MEMBER_CAP);

  return rows.map((row) => ({
    emoji: row.emoji,
    user: {
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      imageUrl: row.imageUrl,
    },
  }));
}

// Group columns reused for the hub's membership + invite lists.
const groupCardColumns = {
  id: groupTable.id,
  name: groupTable.name,
  tag: groupTable.tag,
  icon: groupTable.icon,
  accent: groupTable.accent,
  memberCount: groupTable.memberCount,
};

/**
 * The viewer's active memberships AND pending invites for the /groups hub +
 * equip picker. Both bounded reads, run in parallel, under one cache entry so
 * an invite create/accept/decline (which all bust user-groups) refreshes both.
 * Private per-user payload (no-store route).
 */
export async function getUserGroups(
  db: Db,
  userId: string,
): Promise<UserGroupsResponse> {
  const [rows, inviteRows] = await Promise.all([
    db
      .select({
        role: groupMemberTable.role,
        joinedAt: groupMemberTable.createdAt,
        group: groupCardColumns,
      })
      .from(groupMemberTable)
      .innerJoin(groupTable, eq(groupMemberTable.groupId, groupTable.id))
      .where(eq(groupMemberTable.userId, userId))
      .orderBy(asc(groupMemberTable.createdAt))
      .limit(JOINED_GROUPS_CAP),
    // Pending invites awaiting this user's accept/decline. Keyset index
    // group_pending_user_created_idx; bounded so spam can't unbound the read.
    db
      .select({
        invitedAt: groupPendingTable.createdAt,
        group: groupCardColumns,
      })
      .from(groupPendingTable)
      .innerJoin(groupTable, eq(groupPendingTable.groupId, groupTable.id))
      .where(
        and(
          eq(groupPendingTable.userId, userId),
          eq(groupPendingTable.kind, "invite"),
        ),
      )
      .orderBy(asc(groupPendingTable.createdAt))
      .limit(GROUP_MEMBERS_PAGE_SIZE),
  ]);

  return {
    data: rows.map((row) => ({
      group: row.group,
      role: row.role,
      joinedAt: row.joinedAt,
    })),
    invites: inviteRows.map((row) => ({
      group: row.group,
      invitedAt: row.invitedAt,
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
  db: Db,
  viewerId: string,
  groupId: string,
): Promise<GroupRelationship | null> {
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
  db: Db,
  groupId: string,
  cursor: string | null,
): Promise<GroupRequestsResponse> {
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
      user: feedAuthorColumns,
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
