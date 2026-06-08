import type { SelectNote } from "@umamin/db/schema/note";
import type { FeedSort } from "@/lib/feed-sort";
import type {
  BlockedUsersResponse,
  CommentsResponse,
  CurrentUserResponse,
  FeedResponse,
  FollowListResponse,
  GroupMembersResponse,
  GroupPageData,
  GroupRequestsResponse,
  GroupViewerResponse,
  MessagesResponse,
  NotesResponse,
  NotificationBadgeResponse,
  NotificationsResponse,
  PostResponse,
  UserGroupsResponse,
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
  sort: FeedSort,
) {
  const baseUrl = isAuthenticated ? "/api/posts" : "/api/public/posts";
  const params = new URLSearchParams({ sort });
  if (cursor) {
    params.set("cursor", cursor);
  }
  const url = `${baseUrl}?${params.toString()}`;
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

// Always uses the public CDN-cached route so the profile page stays static and
// cheap. isLiked/isReposted are eventually-consistent on the profile card; the
// post-detail/feed views carry the live per-viewer state.
export async function fetchUserPostsPage(
  username: string,
  cursor: string | null,
) {
  const url = appendCursor(`/api/public/user/${username}/posts`, cursor);
  return fetchJson<FeedResponse>(url);
}

export async function fetchCurrentNote() {
  return fetchJson<SelectNote | null>(`/api/notes/current`);
}

// Newest feed-edge timestamp (Redis-backed, briefly CDN-cached). Drives the
// "new posts" pill without polling Turso. `latest` is null when Redis is unset.
export async function fetchFeedHead() {
  return fetchJson<{ latest: number | null }>("/api/feed/head");
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

export async function fetchFollowersPage(
  username: string,
  cursor: string | null,
) {
  const url = appendCursor(`/api/user/${username}/followers`, cursor);
  return fetchJson<FollowListResponse>(url);
}

export async function fetchFollowingPage(
  username: string,
  cursor: string | null,
) {
  const url = appendCursor(`/api/user/${username}/following`, cursor);
  return fetchJson<FollowListResponse>(url);
}

export async function fetchBlockedUsersPage(cursor: string | null) {
  return fetchJson<BlockedUsersResponse>(
    appendCursor("/api/blocked-users", cursor),
  );
}

export async function fetchNotificationBadge() {
  return fetchJson<NotificationBadgeResponse>("/api/notifications/badge");
}

export async function fetchNotificationsPage(cursor: string | null) {
  return fetchJson<NotificationsResponse>(
    appendCursor("/api/notifications", cursor),
  );
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

export async function fetchUserGroups() {
  return fetchJson<UserGroupsResponse>("/api/groups");
}

export async function fetchGroup(tagOrId: string) {
  return fetchJson<GroupPageData | null>(`/api/groups/${tagOrId}`);
}

export async function fetchGroupViewer(tagOrId: string) {
  return fetchJson<GroupViewerResponse>(`/api/groups/${tagOrId}/viewer`);
}

export async function fetchGroupMembersPage(
  tagOrId: string,
  cursor: string | null,
) {
  return fetchJson<GroupMembersResponse>(
    appendCursor(`/api/groups/${tagOrId}/members`, cursor),
  );
}

export async function fetchGroupRequestsPage(
  tagOrId: string,
  cursor: string | null,
) {
  return fetchJson<GroupRequestsResponse>(
    appendCursor(`/api/groups/${tagOrId}/requests`, cursor),
  );
}
