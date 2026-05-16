import type { SessionValidationResult } from "@umamin/core/session";
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
import { ApiClientError, getJson } from "./api-client";

export async function fetchSession(): Promise<SessionValidationResult> {
  return getJson<SessionValidationResult>("/api/auth/session");
}

function appendCursor(baseUrl: string, cursor: string | null) {
  return cursor ? `${baseUrl}?cursor=${encodeURIComponent(cursor)}` : baseUrl;
}

export async function fetchPostsPage(
  cursor: string | null,
  isAuthenticated: boolean,
) {
  const baseUrl = isAuthenticated ? "/api/posts" : "/api/public/posts";
  const url = appendCursor(baseUrl, cursor);
  return getJson<FeedResponse>(url);
}

export async function fetchPost(postId: string, isAuthenticated: boolean) {
  const baseUrl = isAuthenticated
    ? `/api/posts/${postId}`
    : `/api/public/posts/${postId}`;
  return getJson<PostResponse>(baseUrl);
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

  return getJson<CommentsResponse>(url);
}

export async function fetchNotesPage(
  cursor: string | null,
  isAuthenticated: boolean,
) {
  const baseUrl = isAuthenticated ? "/api/notes" : "/api/public/notes";
  const url = appendCursor(baseUrl, cursor);
  return getJson<NotesResponse>(url);
}

export async function fetchCurrentNote() {
  return getJson<SelectNote | null>(`/api/notes/current`);
}

export async function fetchCurrentUser() {
  return getJson<CurrentUserResponse>("/api/me");
}

export async function fetchCurrentUserOptional(): Promise<CurrentUserResponse> {
  try {
    return await getJson<CurrentUserResponse>("/api/me");
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) {
      return { user: undefined };
    }
    throw error;
  }
}

export async function fetchUserProfile(username: string) {
  return getJson<UserProfileResponse>(
    `/api/public/user/${encodeURIComponent(username)}`,
  );
}

export async function fetchUserProfileViewer(username: string) {
  return getJson<UserProfileViewerResponse>(
    `/api/user/${encodeURIComponent(username)}/viewer`,
  );
}

export async function fetchMessagesPage(
  type: "received" | "sent",
  cursor: string | null,
) {
  const searchParams = new URLSearchParams({ type });
  if (cursor) searchParams.set("cursor", cursor);
  const url = `/api/messages?${searchParams}`;

  return getJson<MessagesResponse>(url);
}
