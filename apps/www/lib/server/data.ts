import "server-only";

import type { SelectNote } from "@umamin/db/schema/note";
import { apiJson } from "@/lib/api";
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

function appendCursor(baseUrl: string, cursor?: string | null) {
  return cursor ? `${baseUrl}?cursor=${encodeURIComponent(cursor)}` : baseUrl;
}

export async function getPostsPage(params: {
  cursor?: string | null;
  viewerId?: string | null;
}): Promise<FeedResponse> {
  const baseUrl = params.viewerId ? "/api/posts" : "/api/public/posts";
  return apiJson<FeedResponse>(appendCursor(baseUrl, params.cursor));
}

export async function getPostById(params: {
  postId: string;
  viewerId?: string | null;
}): Promise<PostResponse> {
  const baseUrl = params.viewerId
    ? `/api/posts/${params.postId}`
    : `/api/public/posts/${params.postId}`;
  return apiJson<PostResponse>(baseUrl);
}

export async function getPostCommentsPage(params: {
  postId: string;
  cursor?: string | null;
  viewerId?: string | null;
}): Promise<CommentsResponse> {
  const baseUrl = params.viewerId
    ? `/api/posts/${params.postId}/comments`
    : `/api/public/posts/${params.postId}/comments`;
  return apiJson<CommentsResponse>(appendCursor(baseUrl, params.cursor));
}

export async function getNotesPage(params: {
  cursor?: string | null;
  viewerId?: string | null;
}): Promise<NotesResponse> {
  const baseUrl = params.viewerId ? "/api/notes" : "/api/public/notes";
  return apiJson<NotesResponse>(appendCursor(baseUrl, params.cursor));
}

export async function getCurrentNoteData(_userId: string) {
  return apiJson<SelectNote | null>("/api/notes/current");
}

export async function getCurrentUserData(
  _userId: string,
): Promise<CurrentUserResponse> {
  return apiJson<CurrentUserResponse>("/api/me");
}

export async function getPublicUserProfileData(
  username: string,
): Promise<UserProfileResponse> {
  return apiJson<UserProfileResponse>(
    `/api/public/user/${encodeURIComponent(username)}`,
  );
}

export async function getUserProfileViewerData(
  username: string,
  _viewerId?: string | null,
): Promise<UserProfileViewerResponse | null> {
  return apiJson<UserProfileViewerResponse>(
    `/api/user/${encodeURIComponent(username)}/viewer`,
  );
}

export async function getUserProfileData(
  username: string,
  viewerId?: string | null,
) {
  const user = await getPublicUserProfileData(username);

  if (!user || !viewerId) {
    return user;
  }

  const overlay = await getUserProfileViewerData(username, viewerId);
  return {
    ...user,
    ...(overlay ?? {}),
  };
}

export async function getMessagesPage(params: {
  type: "received" | "sent";
  cursor?: string | null;
  userId: string;
}): Promise<MessagesResponse> {
  const searchParams = new URLSearchParams({ type: params.type });
  if (params.cursor) {
    searchParams.set("cursor", params.cursor);
  }
  return apiJson<MessagesResponse>(`/api/messages?${searchParams}`);
}
