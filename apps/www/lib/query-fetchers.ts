import type { SelectNote } from "@umamin/db/schema/note";
import type {
  CommentsResponse,
  CurrentUserResponse,
  FeedResponse,
  MessagesResponse,
  NotesResponse,
  PostResponse,
  UserProfileResponse,
  UserProfileViewerResponse,
} from "@/lib/query-types";

async function fetchJson<T>(input: string): Promise<T> {
  const response = await fetch(input, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${input}`);
  }

  return (await response.json()) as T;
}

function appendCursor(baseUrl: string, cursor: string | null) {
  return cursor ? `${baseUrl}?cursor=${cursor}` : baseUrl;
}

export async function fetchPostsPage(
  cursor: string | null,
  isAuthenticated: boolean,
) {
  const baseUrl = isAuthenticated ? "/api/posts" : "/api/public/posts";
  const url = appendCursor(baseUrl, cursor);
  return fetchJson<FeedResponse>(url);
}

export async function fetchPost(postId: string, isAuthenticated: boolean) {
  const baseUrl = isAuthenticated
    ? `/api/posts/${postId}`
    : `/api/public/posts/${postId}`;
  return fetchJson<PostResponse>(baseUrl);
}

export async function fetchPostCommentsPage(
  postId: string,
  cursor: string | null,
  isAuthenticated: boolean,
) {
  const baseUrl = isAuthenticated
    ? `/api/posts/${postId}/comments`
    : `/api/public/posts/${postId}/comments`;
  const url = appendCursor(baseUrl, cursor);

  return fetchJson<CommentsResponse>(url);
}

export async function fetchNotesPage(
  cursor: string | null,
  isAuthenticated: boolean,
) {
  const baseUrl = isAuthenticated ? "/api/notes" : "/api/public/notes";
  const url = appendCursor(baseUrl, cursor);
  return fetchJson<NotesResponse>(url);
}

export async function fetchCurrentNote() {
  return fetchJson<SelectNote | null>(`/api/notes/current`);
}

export async function fetchCurrentUser() {
  return fetchJson<CurrentUserResponse>("/api/me");
}

export async function fetchCurrentUserOptional() {
  const response = await fetch("/api/me", {
    credentials: "include",
  });

  if (response.status === 401) {
    return {} as CurrentUserResponse;
  }

  if (!response.ok) {
    throw new Error("Request failed for /api/me");
  }

  return (await response.json()) as CurrentUserResponse;
}

export async function fetchUserProfile(username: string) {
  return fetchJson<UserProfileResponse>(`/api/public/user/${username}`);
}

export async function fetchUserProfileViewer(username: string) {
  return fetchJson<UserProfileViewerResponse>(`/api/user/${username}/viewer`);
}

export async function fetchMessagesPage(
  type: "received" | "sent",
  cursor: string | null,
) {
  const url = cursor
    ? `/api/messages?type=${type}&cursor=${cursor}`
    : `/api/messages?type=${type}`;

  return fetchJson<MessagesResponse>(url);
}
