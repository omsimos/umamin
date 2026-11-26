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
// reload can bring back a comment this browser just deleted. The ids live in
// sessionStorage so they survive that reload.
const DELETED_COMMENTS_KEY = "umamin:deleted-comments";
const DELETED_COMMENT_TTL_MS = 5 * 60_000;

function readDeletedComments(): Map<string, number> {
  const now = Date.now();
  try {
    const raw = sessionStorage.getItem(DELETED_COMMENTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return new Map();
    return new Map(
      Object.entries(parsed).filter(
        (entry): entry is [string, number] =>
          typeof entry[1] === "number" &&
          now - entry[1] < DELETED_COMMENT_TTL_MS,
      ),
    );
  } catch {
    // No sessionStorage on the server, or the browser blocks it.
    return new Map();
  }
}

export function rememberDeletedComment(commentId: string): void {
  const deleted = readDeletedComments();
  deleted.set(commentId, Date.now());
  try {
    sessionStorage.setItem(
      DELETED_COMMENTS_KEY,
      JSON.stringify(Object.fromEntries(deleted)),
    );
  } catch {
    // Without storage the delete still holds until the next reload.
  }
}

function withoutDeleted(
  page: CommentsResponse,
  deleted: Map<string, number>,
): CommentsResponse {
  const data = page.data.filter((comment) => !deleted.has(comment.id));
  return data.length === page.data.length ? page : { ...page, data };
}

export function dropDeletedComments(page: CommentsResponse): CommentsResponse {
  const deleted = readDeletedComments();
  return deleted.size === 0 ? page : withoutDeleted(page, deleted);
}

/**
 * Removes remembered deletes from a comments entry that was filled without
 * the filter, such as by SSR hydration. Call it from an effect, never during
 * render: the server can't read sessionStorage.
 */
export function pruneDeletedComments(
  queryClient: QueryClient,
  postId: string,
): void {
  const deleted = readDeletedComments();
  if (deleted.size === 0) return;
  const key = queryKeys.postComments(postId);
  const current = queryClient.getQueryData<InfiniteData<CommentsResponse>>(key);
  if (!current?.pages.some((page) => page.data.some((c) => deleted.has(c.id))))
    return;
  queryClient.setQueryData<InfiniteData<CommentsResponse>>(key, {
    ...current,
    pages: current.pages.map((page) => withoutDeleted(page, deleted)),
  });
}
