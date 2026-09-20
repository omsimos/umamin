import type {
  InfiniteData,
  QueryClient,
  QueryKey,
} from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import type { FeedSort } from "@/lib/feed-sort";

export const PUBLIC_STALE_TIME = 120_000;
export const PRIVATE_STALE_TIME = 30_000;

const stableRefetchOptions = {
  refetchOnMount: false as const,
  refetchOnReconnect: false as const,
  refetchOnWindowFocus: false as const,
};

export const queryKeys = {
  posts: (sort: FeedSort, viewerKey: string = "public") =>
    ["posts", sort, viewerKey] as const,
  postsRoot: () => ["posts"] as const,
  post: (postId: string) => ["post", postId] as const,
  postComments: (postId: string) => ["post-comments", postId] as const,
  notes: (viewerKey: string = "public") => ["notes", viewerKey] as const,
  notesRoot: () => ["notes"] as const,
  userPosts: (username: string) => ["user-posts", username] as const,
  userPostsRoot: () => ["user-posts"] as const,
  currentNote: () => ["current_note"] as const,
  currentUser: () => ["current_user"] as const,
  userProfile: (username: string) => ["user-profile", username] as const,
  userProfileViewer: (username: string) =>
    ["user-profile-viewer", username] as const,
  followers: (username: string) => ["followers", username] as const,
  following: (username: string) => ["following", username] as const,
  blockedUsers: () => ["blocked_users"] as const,
  receivedMessages: () => ["received_messages"] as const,
  sentMessages: () => ["sent_messages"] as const,
  messageThread: (messageId: string) => ["message-thread", messageId] as const,
  notifications: () => ["notifications"] as const,
  notificationBadge: () => ["notification_badge"] as const,
  userGroups: () => ["user_groups"] as const,
  group: (tagOrId: string) => ["group", tagOrId] as const,
  groupMembers: (tagOrId: string) => ["group-members", tagOrId] as const,
  groupRequests: (tagOrId: string) => ["group-requests", tagOrId] as const,
  groupViewer: (tagOrId: string) => ["group-viewer", tagOrId] as const,
  groupChat: (tagOrId: string) => ["group-chat", tagOrId] as const,
  groupChatHead: (groupId: string) => ["group-chat-head", groupId] as const,
  groupUnread: () => ["group-unread"] as const,
  featureFlags: () => ["feature-flags"] as const,
};

export const infiniteQueryDefaults = {
  ...stableRefetchOptions,
};

// Refresh an infinite list from the top: keep page 1 on screen, drop the rest,
// and refetch page 1 only. A bare invalidate refetches EVERY loaded page in
// sequence (v5 has no refetchPage), which is one Turso read per page for a
// single gesture. Matching by prefix so every sort/viewer variant is trimmed.
export async function refreshInfiniteQueries(
  queryClient: QueryClient,
  queryKey: QueryKey,
) {
  queryClient.setQueriesData<InfiniteData<unknown>>({ queryKey }, (old) =>
    old && old.pages.length > 1
      ? { pages: old.pages.slice(0, 1), pageParams: old.pageParams.slice(0, 1) }
      : old,
  );
  await queryClient.invalidateQueries({ queryKey });
}

export const privateQueryDefaults = {
  ...stableRefetchOptions,
  staleTime: PRIVATE_STALE_TIME,
};

export const publicQueryDefaults = {
  ...stableRefetchOptions,
  staleTime: PUBLIC_STALE_TIME,
};

export function pageQueryOptions<TData>(
  queryKey: QueryKey,
  queryFn: () => Promise<TData>,
  staleTime = PRIVATE_STALE_TIME,
) {
  return queryOptions({
    queryKey,
    queryFn,
    staleTime,
    ...stableRefetchOptions,
  });
}
