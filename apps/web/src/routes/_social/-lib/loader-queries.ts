import type { FeedSort } from "@/lib/feed-sort";
import { loaderFetchJson, loaderFetchJsonOrNull } from "@/lib/loader-fetch";
import type {
  CommentsResponse,
  FeedResponse,
  NoteItem,
  NotesResponse,
  PostResponse,
  UserProfileResponse,
} from "@/lib/types";

// Loader-side query fetchers: same URLs as the `@/lib/query-fetchers` browser
// fetchers, but routed through `loaderFetchJson` so they work in the Worker (SSR:
// absolute origin + forwarded cookie) and on client navigation (relative +
// credentials). The queryKeys these prime match the client `useInfiniteQuery`
// keys 1:1, so the hydrated cache is reused without a re-fetch.

export function loaderFetchPostsPage(
  cursor: string | null,
  isAuthenticated: boolean,
  sort: FeedSort,
) {
  const base = isAuthenticated ? "/api/posts" : "/api/public/posts";
  const params = new URLSearchParams({ sort });
  if (cursor) params.set("cursor", cursor);
  return loaderFetchJson<FeedResponse>(`${base}?${params.toString()}`);
}

export function loaderFetchNotesPage(
  cursor: string | null,
  isAuthenticated: boolean,
) {
  const base = isAuthenticated ? "/api/notes" : "/api/public/notes";
  return loaderFetchJson<NotesResponse>(
    cursor ? `${base}?cursor=${cursor}` : base,
  );
}

export function loaderFetchUserPostsPage(
  username: string,
  cursor: string | null,
) {
  const base = `/api/public/user/${username}/posts`;
  return loaderFetchJson<FeedResponse>(
    cursor ? `${base}?cursor=${cursor}` : base,
  );
}

export function loaderFetchPostCommentsPage(
  postId: string,
  cursor: string | null,
  isAuthenticated: boolean,
) {
  const base = isAuthenticated
    ? `/api/posts/${postId}/comments`
    : `/api/public/posts/${postId}/comments`;
  return loaderFetchJson<CommentsResponse>(
    cursor ? `${base}?cursor=${cursor}` : base,
  );
}

// null when the post doesn't exist (→ the loader turns it into notFound()).
export function loaderFetchPost(postId: string, isAuthenticated: boolean) {
  const base = isAuthenticated
    ? `/api/posts/${postId}`
    : `/api/public/posts/${postId}`;
  return loaderFetchJsonOrNull<NonNullable<PostResponse>>(base, 404);
}

// null when the user doesn't exist (→ notFound()).
export function loaderFetchUserProfile(username: string) {
  return loaderFetchJsonOrNull<NonNullable<UserProfileResponse>>(
    `/api/public/user/${username}`,
    404,
  );
}

export function loaderFetchCurrentNote() {
  return loaderFetchJson<NoteItem | null>("/api/notes/current");
}
