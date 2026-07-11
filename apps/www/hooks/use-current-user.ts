"use client";

import { useQuery } from "@tanstack/react-query";
import { privateQueryDefaults, queryKeys } from "@/lib/query";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";

// Shared, deduped current-user observer. Every call site subscribes to one
// cache entry (queryKeys.currentUser); privateQueryDefaults disables
// refetch-on-mount/focus/reconnect, so a virtualized feed/notes row mounting
// into view reads the cached value instead of firing a fresh /api/me request
// each time the 30s staleTime lapses. Pass `isAuthenticated` so the query stays
// idle for logged-out viewers.
export function useCurrentUser(enabled = true) {
  return useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    ...privateQueryDefaults,
    enabled,
  });
}
