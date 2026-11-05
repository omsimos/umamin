import type { FeedSort } from "@/lib/feed-sort";
import {
  loaderFetchJson,
  loaderFetchJsonOrNull,
  ssrSessionCookiePresent,
} from "@/lib/loader-fetch";
import type {
  CommentsResponse,
  FeedResponse,
  NoteItem,
  NotesResponse,
  PostResponse,
  UserProfileResponse,
  UserProfileViewerResponse,
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

export function loaderFetchUserProfileViewer(username: string) {
  return loaderFetchJson<UserProfileViewerResponse>(
    `/api/user/${username}/viewer`,
  );
}

/**
 * Starts a signed-in read on SSR without waiting for the viewer lookup, so a
 * page doesn't chain its own data behind /api/me. The request validates the
 * session itself, and the session single-flight shares that lookup with
 * /api/me. Use the result only once the viewer has resolved: a stale cookie
 * resolves no viewer, and then the read is dropped.
 *
 * Null without a session cookie, and always on the client, where the cookie is
 * unreadable and the viewer is usually already cached.
 */
export async function startSignedInRead<T>(
  read: () => Promise<T>,
): Promise<{ pending: Promise<T> } | null> {
  if (!(await ssrSessionCookiePresent())) return null;

  const pending = read();
  // A dropped read must not surface as an unhandled rejection.
  pending.catch(() => {});
  return { pending };
}
