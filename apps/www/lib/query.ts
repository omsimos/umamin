import type { QueryKey } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";

export const PUBLIC_STALE_TIME = 120_000;
export const PRIVATE_STALE_TIME = 30_000;
export const QUERY_GC_TIME = 1000 * 60 * 15;

export type QueryScope = "public" | "viewer";

export function queryScope(isAuthenticated: boolean): QueryScope {
  return isAuthenticated ? "viewer" : "public";
}

const stableRefetchOptions = {
  refetchOnMount: false as const,
  refetchOnReconnect: false as const,
  refetchOnWindowFocus: false as const,
};

export const queryKeys = {
  posts: (scope: QueryScope = "viewer") => ["posts", scope] as const,
  postsAll: () => ["posts"] as const,
  post: (postId: string, scope: QueryScope = "viewer") =>
    ["post", postId, scope] as const,
  postAll: (postId: string) => ["post", postId] as const,
  postComments: (postId: string, scope: QueryScope = "viewer") =>
    ["post-comments", postId, scope] as const,
  postCommentsAll: (postId: string) => ["post-comments", postId] as const,
  notes: (scope: QueryScope = "viewer") => ["notes", scope] as const,
  notesAll: () => ["notes"] as const,
  currentNote: () => ["current_note"] as const,
  currentUser: () => ["current_user"] as const,
  userProfile: (username: string) => ["user-profile", username] as const,
  userProfileViewer: (username: string) =>
    ["user-profile-viewer", username] as const,
  receivedMessages: () => ["received_messages"] as const,
  sentMessages: () => ["sent_messages"] as const,
};

export const infiniteQueryDefaults = {
  ...stableRefetchOptions,
  gcTime: QUERY_GC_TIME,
};

export const privateQueryDefaults = {
  ...stableRefetchOptions,
  staleTime: PRIVATE_STALE_TIME,
  gcTime: QUERY_GC_TIME,
};

export const publicQueryDefaults = {
  ...stableRefetchOptions,
  staleTime: PUBLIC_STALE_TIME,
  gcTime: QUERY_GC_TIME,
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
    gcTime: QUERY_GC_TIME,
    ...stableRefetchOptions,
  });
}
