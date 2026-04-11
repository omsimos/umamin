import "server-only";

import { db } from "@umamin/db";
import { messageTable } from "@umamin/db/schema/message";
import { noteTable } from "@umamin/db/schema/note";
import {
  postCommentLikeTable,
  postCommentTable,
  postLikeTable,
  postRepostTable,
  postTable,
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
} from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import type {
  CommentsResponse,
  CurrentUserResponse,
  FeedResponse,
  MessagesResponse,
  NoteItem,
  NotesResponse,
  PostResponse,
} from "@/lib/query-types";
import type { CommentData, FeedItem } from "@/types/post";
import type { PublicUser } from "@/types/user";

const PUBLIC_REVALIDATE_SECONDS = 120;
const PRIVATE_REVALIDATE_SECONDS = 30;
const FEED_PAGE_SIZE = 40;
const COMMENTS_PAGE_SIZE = 20;
const MESSAGES_PAGE_SIZE = 20;

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

function parseFeedCursor(cursor: string | null) {
  let cursorConditionPost: ReturnType<typeof or> | undefined;
  let cursorConditionRepost: ReturnType<typeof or> | undefined;

  if (!cursor) {
    return { cursorConditionPost, cursorConditionRepost };
  }

  const [msRaw, typeRaw, idRaw] = cursor.split(".");
  const ms = Number(msRaw);
  const cursorDate = Number.isNaN(ms) ? null : new Date(ms);
  const isRepostCursor = typeRaw === "repost";

  if (!cursorDate || !idRaw) {
    return { cursorConditionPost, cursorConditionRepost };
  }

  if (isRepostCursor) {
    cursorConditionRepost = or(
      lt(postRepostTable.createdAt, cursorDate),
      and(
        eq(postRepostTable.createdAt, cursorDate),
        lt(postRepostTable.id, idRaw),
      ),
    );
    cursorConditionPost = or(
      lt(postTable.createdAt, cursorDate),
      and(eq(postTable.createdAt, cursorDate), lt(postTable.id, idRaw)),
    );
  } else {
    cursorConditionPost = or(
      lt(postTable.createdAt, cursorDate),
      and(eq(postTable.createdAt, cursorDate), lt(postTable.id, idRaw)),
    );
    cursorConditionRepost = lt(postRepostTable.createdAt, cursorDate);
  }

  return { cursorConditionPost, cursorConditionRepost };
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

function getFeedNextCursor(item?: FeedItem) {
  if (!item) return null;

  return `${
    item.type === "post"
      ? item.post.createdAt.getTime()
      : item.repost.createdAt.getTime()
  }.${item.type}.${item.type === "post" ? item.post.id : item.repost.id}`;
}

function mergeAndSortFeedItems(postItems: FeedItem[], repostItems: FeedItem[]) {
  return [...postItems, ...repostItems].sort((a, b) => {
    const aDate = a.type === "post" ? a.post.createdAt : a.repost.createdAt;
    const bDate = b.type === "post" ? b.post.createdAt : b.repost.createdAt;

    if (aDate.getTime() !== bDate.getTime()) {
      return bDate.getTime() - aDate.getTime();
    }

    const aOrder = a.type === "repost" ? 1 : 0;
    const bOrder = b.type === "repost" ? 1 : 0;
    if (aOrder !== bOrder) {
      return bOrder - aOrder;
    }

    const aId = a.type === "post" ? a.post.id : a.repost.id;
    const bId = b.type === "post" ? b.post.id : b.repost.id;
    return bId.localeCompare(aId);
  });
}

async function getPublicPostsPage(
  cursor: string | null,
): Promise<FeedResponse> {
  "use cache";
  cacheTag("posts");
  cacheLife({ revalidate: PUBLIC_REVALIDATE_SECONDS });

  const { cursorConditionPost, cursorConditionRepost } =
    parseFeedCursor(cursor);

  const basePostQuery = db
    .select({
      post: postTable,
      author: publicUserColumns,
    })
    .from(postTable)
    .leftJoin(userTable, eq(postTable.authorId, userTable.id))
    .orderBy(desc(postTable.createdAt), desc(postTable.id));

  const postRows = await (cursorConditionPost
    ? basePostQuery.where(cursorConditionPost)
    : basePostQuery
  ).limit(FEED_PAGE_SIZE);

  const postItems: FeedItem[] = postRows.flatMap(({ post, author }) => {
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

  const baseRepostQuery = db
    .select({
      repost: postRepostTable,
      post: postTable,
      authorId: postTable.authorId,
      reposterId: postRepostTable.userId,
    })
    .from(postRepostTable)
    .innerJoin(postTable, eq(postRepostTable.postId, postTable.id))
    .orderBy(desc(postRepostTable.createdAt), desc(postRepostTable.id));

  const repostRows = await (cursorConditionRepost
    ? baseRepostQuery.where(cursorConditionRepost)
    : baseRepostQuery
  ).limit(FEED_PAGE_SIZE);

  const userIds = Array.from(
    new Set(
      repostRows.flatMap(
        (row) => [row.authorId, row.reposterId].filter(Boolean) as string[],
      ),
    ),
  );

  const users =
    userIds.length > 0
      ? await db
          .select(publicUserColumns)
          .from(userTable)
          .where(inArray(userTable.id, userIds))
      : [];

  const userMap = new Map(users.map((user) => [user.id, user] as const));

  const repostItems: FeedItem[] = repostRows.flatMap((row) => {
    const author = userMap.get(row.authorId);
    const reposter = userMap.get(row.reposterId);

    if (!author || !reposter) {
      return [];
    }

    return [
      {
        type: "repost" as const,
        post: {
          ...row.post,
          author,
          isLiked: false,
          isReposted: false,
        },
        repost: {
          id: row.repost.id,
          postId: row.repost.postId,
          content: row.repost.content ?? undefined,
          createdAt: row.repost.createdAt,
          user: reposter,
        },
      },
    ];
  });

  const pageItems = mergeAndSortFeedItems(postItems, repostItems).slice(
    0,
    FEED_PAGE_SIZE,
  );

  return {
    data: pageItems,
    nextCursor: getFeedNextCursor(pageItems[pageItems.length - 1]),
  };
}

async function getPostFeedViewerOverlay(viewerId: string, items: FeedItem[]) {
  "use cache: private";
  cacheTag(`user-blocks:${viewerId}`);

  const postIds = Array.from(
    new Set(items.map((item) => item.post.id).filter(Boolean)),
  );
  const actorIds = Array.from(
    new Set(
      items.flatMap((item) =>
        item.type === "post"
          ? [item.post.author.id]
          : [item.post.author.id, item.repost.user.id],
      ),
    ),
  );

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
  viewerId?: string | null;
}): Promise<FeedResponse> {
  const publicData = await getPublicPostsPage(params.cursor ?? null);

  if (!params.viewerId) {
    return publicData;
  }

  const overlay = await getPostFeedViewerOverlay(
    params.viewerId,
    publicData.data,
  );

  return {
    ...publicData,
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
  "use cache: private";
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
    .limit(COMMENTS_PAGE_SIZE);

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

  const lastItem = data[data.length - 1];

  return {
    data,
    nextCursor: lastItem
      ? `${lastItem.createdAt.getTime()}.${lastItem.id}`
      : null,
  };
}

async function getCommentViewerOverlay(
  viewerId: string,
  comments: CommentData[],
) {
  "use cache: private";
  cacheTag(`user-blocks:${viewerId}`);

  const commentIds = comments.map((comment) => comment.id);
  const authorIds = Array.from(
    new Set(comments.map((comment) => comment.author.id)),
  );

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

  const overlay = await getCommentViewerOverlay(
    params.viewerId,
    publicData.data,
  );

  return {
    ...publicData,
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
    .limit(FEED_PAGE_SIZE);

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

  const lastItem = data[data.length - 1];

  return {
    data,
    nextCursor: lastItem
      ? `${lastItem.updatedAt?.getTime()}.${lastItem.id}`
      : null,
  };
}

async function getNoteViewerOverlay(viewerId: string, notes: NoteItem[]) {
  "use cache: private";
  cacheTag(`user-blocks:${viewerId}`);
  cacheLife({ revalidate: PRIVATE_REVALIDATE_SECONDS });

  const authorIds = Array.from(
    new Set(notes.flatMap((note) => (note.user?.id ? [note.user.id] : []))),
  );

  const blockRows =
    authorIds.length > 0
      ? await db
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
      : [];

  return new Set(
    blockRows.flatMap((row) =>
      row.blockerId === viewerId ? [row.blockedId] : [row.blockerId],
    ),
  );
}

export async function getNotesPage(params: {
  cursor?: string | null;
  viewerId?: string | null;
}): Promise<NotesResponse> {
  const publicData = await getPublicNotesPage(params.cursor ?? null);

  if (!params.viewerId) {
    return publicData;
  }

  const blockedUserIds = await getNoteViewerOverlay(
    params.viewerId,
    publicData.data,
  );

  return {
    ...publicData,
    data: publicData.data.flatMap((note) =>
      note.user?.id && blockedUserIds.has(note.user.id) ? [] : [note],
    ),
  };
}

export async function getCurrentNoteData(userId: string) {
  const getCachedData = async () => {
    "use cache: private";
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
    "use cache: private";
    cacheTag(`user:${userId}`);
    cacheLife({ revalidate: PRIVATE_REVALIDATE_SECONDS });

    const [userRecord] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    return userRecord;
  };

  const userRecord = await getUserRecord();

  if (!userRecord) {
    return {};
  }

  const getAccounts = async () => {
    "use cache: private";
    cacheTag(`user:${userId}:accounts`);
    cacheLife({ revalidate: PRIVATE_REVALIDATE_SECONDS });

    return db
      .select()
      .from(accountTable)
      .where(eq(accountTable.userId, userId));
  };

  const accounts = await getAccounts();

  return {
    user: {
      ...userRecord,
      accounts,
    },
  };
}

async function getPublicUserProfile(username: string) {
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
  "use cache: private";
  cacheTag(`user:${username}:followed:${viewerId}`);
  cacheTag(`user:${username}:blocked:${viewerId}`);
  cacheTag(`user:${username}:blocked-by:${viewerId}`);
  cacheLife({ revalidate: PRIVATE_REVALIDATE_SECONDS });

  const [follow, blocked, blockedBy] = await Promise.all([
    db
      .select({
        following: exists(
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
      })
      .from(userTable)
      .where(eq(userTable.id, targetId))
      .limit(1),
    db
      .select({
        blocked: exists(
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
      })
      .from(userTable)
      .where(eq(userTable.id, targetId))
      .limit(1),
    db
      .select({
        blocked: exists(
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
      .limit(1),
  ]);

  return {
    isFollowing: Boolean(follow?.[0]?.following),
    isBlocked: Boolean(blocked?.[0]?.blocked),
    isBlockedBy: Boolean(blockedBy?.[0]?.blocked),
  };
}

export async function getUserProfileData(
  username: string,
  viewerId?: string | null,
) {
  const user = await getPublicUserProfile(username);

  if (!user || !viewerId) {
    return user;
  }

  const overlay = await getUserProfileViewerOverlay(
    viewerId,
    username,
    user.id,
  );

  return {
    ...user,
    ...overlay,
  };
}

export async function getMessagesPage(params: {
  type: "received" | "sent";
  cursor?: string | null;
  userId: string;
}): Promise<MessagesResponse> {
  const getCachedData = async () => {
    "use cache: private";
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
      .limit(MESSAGES_PAGE_SIZE);

    const data = rows
      .filter((row) => row.receiver !== null)
      .map(({ message, receiver }) => ({
        ...message,
        receiver,
      }));

    const messagesData = await Promise.all(
      data.map(async (message) => {
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

        return {
          ...message,
          content,
          reply,
        };
      }),
    );

    return {
      messages: messagesData,
      nextCursor:
        messagesData.length === MESSAGES_PAGE_SIZE
          ? `${messagesData[messagesData.length - 1].createdAt?.getTime()}.${
              messagesData[messagesData.length - 1].id
            }`
          : null,
    };
  };

  return getCachedData();
}
