import type { QueryKey } from "@tanstack/react-query";
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
  notes: () => ["notes"] as const,
  userPosts: (username: string) => ["user-posts", username] as const,
  currentNote: () => ["current_note"] as const,
  currentUser: () => ["current_user"] as const,
  userProfile: (username: string) => ["user-profile", username] as const,
  userProfileViewer: (username: string) =>
    ["user-profile-viewer", username] as const,
  followers: (username: string) => ["followers", username] as const,
  following: (username: string) => ["following", username] as const,
  receivedMessages: () => ["received_messages"] as const,
  sentMessages: () => ["sent_messages"] as const,
};

export const infiniteQueryDefaults = {
  ...stableRefetchOptions,
};

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
