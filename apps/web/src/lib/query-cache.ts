import type {
  InfiniteData,
  QueryClient,
  QueryKey,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import type { StreakUpdate } from "@/lib/streak";
import type {
  CommentData,
  CommentsResponse,
  CurrentUserResponse,
  FeedItem,
  FeedResponse,
  FollowListResponse,
  FollowListUser,
  MessagesResponse,
  NoteItem,
  NotesResponse,
  PostData,
  PostResponse,
  UserProfileResponse,
  UserProfileViewerResponse,
} from "@/lib/types";

function uniqueFeedItems(items: FeedItem[]) {
  const map = new Map<string, FeedItem>();

  for (const item of items) {
    const key =
      item.type === "post"
        ? `post:${item.post.id}`
        : `repost:${item.repost.id}`;

    if (!map.has(key)) {
      map.set(key, item);
    }
  }

  return Array.from(map.values());
}

export function prependFeedItem(
  previous: InfiniteData<FeedResponse> | undefined,
  item: FeedItem,
) {
  if (!previous) {
    return {
      pageParams: [null],
      pages: [{ data: [item], nextCursor: null }],
    } satisfies InfiniteData<FeedResponse>;
  }

  const [firstPage, ...restPages] = previous.pages;

  return {
    ...previous,
    pages: [
      {
        ...firstPage,
        data: uniqueFeedItems([item, ...firstPage.data]),
      },
      ...restPages,
    ],
  };
}

export function replaceFeedItem(
  previous: InfiniteData<FeedResponse> | undefined,
  matcher: (item: FeedItem) => boolean,
  replacement: FeedItem,
) {
  if (!previous) return previous;

  return {
    ...previous,
    pages: previous.pages.map((page) => ({
      ...page,
      data: page.data.map((item) => (matcher(item) ? replacement : item)),
    })),
  };
}

export function patchPostAcrossFeed(
  previous: InfiniteData<FeedResponse> | undefined,
  postId: string,
  updater: (post: PostData) => PostData,
) {
  if (!previous) return previous;

  return {
    ...previous,
    pages: previous.pages.map((page) => ({
      ...page,
      data: page.data.map((item) =>
        item.post.id === postId ? { ...item, post: updater(item.post) } : item,
      ),
    })),
  };
}

export function removePostFromFeed(
  previous: InfiniteData<FeedResponse> | undefined,
  postId: string,
) {
  if (!previous) return previous;

  return {
    ...previous,
    pages: previous.pages.map((page) => ({
      ...page,
      data: page.data.filter((item) => item.post.id !== postId),
    })),
  };
}

export function prependComment(
  previous: InfiniteData<CommentsResponse> | undefined,
  comment: CommentData,
) {
  if (!previous) {
    return {
      pageParams: [null],
      pages: [{ data: [comment], nextCursor: null }],
    } satisfies InfiniteData<CommentsResponse>;
  }

  const [firstPage, ...restPages] = previous.pages;

  return {
    ...previous,
    pages: [
      {
        ...firstPage,
        data: [
          comment,
          ...firstPage.data.filter((item) => item.id !== comment.id),
        ],
      },
      ...restPages,
    ],
  };
}

export function replaceComment(
  previous: InfiniteData<CommentsResponse> | undefined,
  matcher: (comment: CommentData) => boolean,
  replacement: CommentData,
) {
  if (!previous) return previous;

  return {
    ...previous,
    pages: previous.pages.map((page) => ({
      ...page,
      data: page.data.map((comment) =>
        matcher(comment) ? replacement : comment,
      ),
    })),
  };
}

export function removeComment(
  previous: InfiniteData<CommentsResponse> | undefined,
  commentId: string,
) {
  if (!previous) return previous;

  return {
    ...previous,
    pages: previous.pages.map((page) => ({
      ...page,
      data: page.data.filter((comment) => comment.id !== commentId),
    })),
  };
}

export function patchComment(
  previous: InfiniteData<CommentsResponse> | undefined,
  commentId: string,
  updater: (comment: CommentData) => CommentData,
) {
  if (!previous) return previous;

  return {
    ...previous,
    pages: previous.pages.map((page) => ({
      ...page,
      data: page.data.map((comment) =>
        comment.id === commentId ? updater(comment) : comment,
      ),
    })),
  };
}

export function patchPostResponse(
  previous: PostResponse | undefined,
  updater: (post: PostData) => PostData,
) {
  if (!previous) return previous;
  return updater(previous);
}

// Every surface that renders a PostCard from an infinite feed. A patch that
// misses one leaves that surface stale for the session (refetch-on-focus/mount
// are off), so like/repost/delete go through these instead of listing keys.
// patchPostEverywhere's `patch` must set absolute values, because it can run
// twice (see applyPatchDurably).
const FEED_ROOTS = [queryKeys.postsRoot(), queryKeys.userPostsRoot()] as const;

// A fetch already in flight builds its result from what it read before this
// write: a refetch asked the server too early, and fetchNextPage appends to
// the pages it captured when it started. When it lands it replaces the patch,
// so the patch runs again right after each such fetch resolves. `apply` must
// set absolute values (never increment), because it can run twice.
export function applyPatchDurably(
  queryClient: QueryClient,
  roots: readonly QueryKey[],
  apply: () => void,
): void {
  const inFlight = roots.flatMap((queryKey) =>
    queryClient.getQueryCache().findAll({ queryKey, fetchStatus: "fetching" }),
  );
  apply();
  for (const query of inFlight) {
    void query.promise?.then(apply, () => undefined);
  }
}

export function patchPostEverywhere(
  queryClient: QueryClient,
  postId: string,
  patch: (post: PostData) => PostData,
): void {
  applyPatchDurably(
    queryClient,
    [...FEED_ROOTS, queryKeys.post(postId)],
    () => {
      for (const queryKey of FEED_ROOTS) {
        queryClient.setQueriesData<InfiniteData<FeedResponse>>(
          { queryKey },
          (current) => patchPostAcrossFeed(current, postId, patch),
        );
      }
      queryClient.setQueryData<PostResponse>(
        queryKeys.post(postId),
        (current) => patchPostResponse(current, patch),
      );
    },
  );
}

export function removePostEverywhere(
  queryClient: QueryClient,
  postId: string,
): void {
  for (const queryKey of FEED_ROOTS) {
    queryClient.setQueriesData<InfiniteData<FeedResponse>>(
      { queryKey },
      (current) => removePostFromFeed(current, postId),
    );
  }
  queryClient.setQueryData(queryKeys.post(postId), null);
}

export function upsertNote(
  previous: InfiniteData<NotesResponse> | undefined,
  note: NoteItem,
) {
  if (!previous) {
    return {
      pageParams: [null],
      pages: [{ data: [note], nextCursor: null }],
    } satisfies InfiniteData<NotesResponse>;
  }

  const [firstPage, ...restPages] = previous.pages;

  return {
    ...previous,
    pages: [
      {
        ...firstPage,
        data: [note, ...firstPage.data.filter((item) => item.id !== note.id)],
      },
      ...restPages,
    ],
  };
}

export function patchNote(
  previous: InfiniteData<NotesResponse> | undefined,
  noteId: string,
  updater: (note: NoteItem) => NoteItem | null,
) {
  if (!previous) return previous;

  return {
    ...previous,
    pages: previous.pages.map((page) => ({
      ...page,
      data: page.data.flatMap((note) => {
        if (note.id !== noteId) {
          return [note];
        }

        const next = updater(note);
        return next ? [next] : [];
      }),
    })),
  };
}

export function removeMessage(
  previous: InfiniteData<MessagesResponse> | undefined,
  messageId: string,
) {
  if (!previous) return previous;

  return {
    ...previous,
    pages: previous.pages.map((page) => ({
      ...page,
      messages: page.messages.filter((message) => message.id !== messageId),
    })),
  };
}

export function patchMessage(
  previous: InfiniteData<MessagesResponse> | undefined,
  messageId: string,
  updater: (
    message: MessagesResponse["messages"][number],
  ) => MessagesResponse["messages"][number],
) {
  if (!previous) return previous;

  return {
    ...previous,
    pages: previous.pages.map((page) => ({
      ...page,
      messages: page.messages.map((message) =>
        message.id === messageId ? updater(message) : message,
      ),
    })),
  };
}

export function patchCurrentUser(
  previous: CurrentUserResponse | undefined,
  updater: (
    user: NonNullable<CurrentUserResponse["user"]>,
  ) => NonNullable<CurrentUserResponse["user"]>,
) {
  if (!previous?.user) return previous;

  return {
    ...previous,
    user: updater(previous.user),
  };
}

export function patchUserProfile(
  previous: UserProfileResponse | undefined,
  updater: (
    user: NonNullable<UserProfileResponse>,
  ) => NonNullable<UserProfileResponse>,
) {
  if (!previous) return previous;

  return updater(previous);
}

export function patchUserProfileViewer(
  previous: UserProfileViewerResponse | undefined,
  updater: (viewer: UserProfileViewerResponse) => UserProfileViewerResponse,
) {
  if (!previous) return previous;

  return updater(previous);
}

export function patchFollowListUser(
  previous: InfiniteData<FollowListResponse> | undefined,
  userId: string,
  updater: (user: FollowListUser) => FollowListUser,
) {
  if (!previous) return previous;

  return {
    ...previous,
    pages: previous.pages.map((page) => ({
      ...page,
      data: page.data.map((user) =>
        user.id === userId ? updater(user) : user,
      ),
    })),
  };
}

// The caches a block changes that no surface patches by hand. Refetch on
// mount is off, so each one needs an explicit invalidation. The profile-viewer
// entry is removed instead: resolveViewer returns a cached value without
// checking whether it is stale. The block removes the follow in both
// directions, so the viewer's own follower and following counts move too.
export function invalidateAfterBlock(
  queryClient: QueryClient,
  username?: string,
): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.blockedUsers() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.currentUser() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.dmPeerRoot() });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.receivedMessages(),
  });
  if (username) {
    queryClient.removeQueries({
      queryKey: queryKeys.userProfileViewer(username),
    });
  }
}

/**
 * Applies a save's new streak to the caches that render it for the author:
 * the current user (composer reminders) and their own profile.
 */
export function applyStreakUpdate(
  queryClient: QueryClient,
  username: string,
  update: StreakUpdate,
) {
  queryClient.setQueryData<CurrentUserResponse>(
    queryKeys.currentUser(),
    (current) => patchCurrentUser(current, (u) => ({ ...u, ...update })),
  );
  queryClient.setQueryData<UserProfileResponse>(
    queryKeys.userProfile(username),
    (current) => patchUserProfile(current, (u) => ({ ...u, ...update })),
  );
}

// The Worker caches every comment page for two minutes (PUBLIC_COMMENTS_MAX_AGE
// in api/routes/public.ts), and signed-in reads overlay that cached page, so a
// reload can bring back a comment this browser just deleted or drop one it
// just posted. Both live in sessionStorage so they survive that reload.
const DELETED_COMMENTS_KEY = "umamin:deleted-comments";
const CREATED_COMMENTS_KEY = "umamin:created-comments";
const RECENT_COMMENT_TTL_MS = 5 * 60_000;
const CREATED_COMMENTS_CAP = 20;

type Remembered<T> = { at: number; value: T };

function readRemembered<T>(key: string): Map<string, Remembered<T>> {
  const now = Date.now();
  try {
    const raw = sessionStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return new Map();
    return new Map(
      Object.entries(parsed as Record<string, Remembered<T>>).filter(
        ([, entry]) =>
          typeof entry?.at === "number" &&
          now - entry.at < RECENT_COMMENT_TTL_MS,
      ),
    );
  } catch {
    // No sessionStorage on the server, or the browser blocks it.
    return new Map();
  }
}

function writeRemembered<T>(
  key: string,
  entries: Map<string, Remembered<T>>,
): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Without storage the change still holds until the next reload.
  }
}

export function rememberDeletedComment(commentId: string): void {
  const deleted = readRemembered<true>(DELETED_COMMENTS_KEY);
  deleted.set(commentId, { at: Date.now(), value: true });
  writeRemembered(DELETED_COMMENTS_KEY, deleted);

  const created = readRemembered<CommentData>(CREATED_COMMENTS_KEY);
  if (created.delete(commentId)) {
    writeRemembered(CREATED_COMMENTS_KEY, created);
  }
}

export function rememberCreatedComment(comment: CommentData): void {
  const created = readRemembered<CommentData>(CREATED_COMMENTS_KEY);
  created.set(comment.id, { at: Date.now(), value: comment });
  const newest = [...created].sort(([, a], [, b]) => b.at - a.at);
  writeRemembered(
    CREATED_COMMENTS_KEY,
    new Map(newest.slice(0, CREATED_COMMENTS_CAP)),
  );
}

function commentTime(comment: CommentData): number {
  return new Date(comment.createdAt).getTime();
}

// Drops remembered deletes from a page and, on the first page, adds the
// remembered comments for this post that `present` lacks. The list is newest
// first, so each one goes before the first older comment. A comment older
// than the whole page belongs on a later page and is left out.
function withRemembered(
  page: CommentsResponse,
  postId: string,
  deleted: Map<string, Remembered<true>>,
  created: Map<string, Remembered<CommentData>>,
  present: Set<string>,
): CommentsResponse {
  let data = page.data.filter((comment) => !deleted.has(comment.id));
  let changed = data.length !== page.data.length;

  for (const { value: comment } of created.values()) {
    if (
      comment.postId !== postId ||
      deleted.has(comment.id) ||
      present.has(comment.id)
    ) {
      continue;
    }
    const time = commentTime(comment);
    const at = data.findIndex((other) => commentTime(other) < time);
    if (at === -1 && page.nextCursor) continue;
    const index = at === -1 ? data.length : at;
    data = [...data.slice(0, index), comment, ...data.slice(index)];
    changed = true;
  }

  return changed ? { ...page, data } : page;
}

/**
 * Applies this browser's recent comment deletes and creates to a page fresh
 * from the server. A remembered comment the page already holds is forgotten:
 * the server has caught up.
 */
export function settleCommentPage(
  postId: string,
  page: CommentsResponse,
  pageParam: unknown,
): CommentsResponse {
  const deleted = readRemembered<true>(DELETED_COMMENTS_KEY);
  const created = readRemembered<CommentData>(CREATED_COMMENTS_KEY);
  if (deleted.size === 0 && created.size === 0) return page;

  const present = new Set(page.data.map((comment) => comment.id));
  let caughtUp = false;
  for (const id of present) {
    if (created.delete(id)) caughtUp = true;
  }
  if (caughtUp) writeRemembered(CREATED_COMMENTS_KEY, created);

  return withRemembered(
    page,
    postId,
    deleted,
    pageParam == null ? created : new Map(),
    present,
  );
}

/**
 * The same for a comments entry that was filled without it, such as by SSR
 * hydration. Call it from an effect, never during render: the server can't
 * read sessionStorage.
 */
export function settleCachedComments(
  queryClient: QueryClient,
  postId: string,
): void {
  const deleted = readRemembered<true>(DELETED_COMMENTS_KEY);
  const created = readRemembered<CommentData>(CREATED_COMMENTS_KEY);
  if (deleted.size === 0 && created.size === 0) return;

  const key = queryKeys.postComments(postId);
  const current = queryClient.getQueryData<InfiniteData<CommentsResponse>>(key);
  if (!current) return;

  const present = new Set(
    current.pages.flatMap((page) => page.data.map((comment) => comment.id)),
  );
  const firstPageIsTop = current.pageParams[0] == null;
  let changed = false;
  const pages = current.pages.map((page, i) => {
    const next = withRemembered(
      page,
      postId,
      deleted,
      i === 0 && firstPageIsTop ? created : new Map(),
      present,
    );
    if (next !== page) changed = true;
    return next;
  });

  if (changed) {
    queryClient.setQueryData<InfiniteData<CommentsResponse>>(key, {
      ...current,
      pages,
    });
  }
}
