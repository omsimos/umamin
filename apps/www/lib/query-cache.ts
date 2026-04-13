import type { InfiniteData } from "@tanstack/react-query";
import type {
  CommentsResponse,
  CurrentUserResponse,
  FeedResponse,
  MessagesResponse,
  NoteItem,
  NotesResponse,
  PostResponse,
  UserProfileResponse,
  UserProfileViewerResponse,
} from "@/lib/query-types";
import type { CommentData, FeedItem, PostData } from "@/types/post";

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
      data: page.data.map((item) => ({
        ...item,
        post: item.post.id === postId ? updater(item.post) : item.post,
      })),
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

export function removeMessagesBySender(
  previous: InfiniteData<MessagesResponse> | undefined,
  senderId: string,
) {
  if (!previous) return previous;

  return {
    ...previous,
    pages: previous.pages.map((page) => ({
      ...page,
      messages: page.messages.filter(
        (message) => message.senderId !== senderId,
      ),
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
