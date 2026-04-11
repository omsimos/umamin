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

export async function fetchPostsPage(cursor: string | null) {
  const url = cursor ? `/api/posts?cursor=${cursor}` : "/api/posts";
  return fetchJson<FeedResponse>(url);
}

export async function fetchPost(postId: string) {
  return fetchJson<PostResponse>(`/api/posts/${postId}`);
}

export async function fetchPostCommentsPage(
  postId: string,
  cursor: string | null,
) {
  const url = cursor
    ? `/api/posts/${postId}/comments?cursor=${cursor}`
    : `/api/posts/${postId}/comments`;

  return fetchJson<CommentsResponse>(url);
}

export async function fetchNotesPage(cursor: string | null) {
  const url = cursor ? `/api/notes?cursor=${cursor}` : "/api/notes";
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
  return fetchJson<UserProfileResponse>(`/api/user/${username}`);
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
