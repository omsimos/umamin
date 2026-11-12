import type { QueryClient } from "@tanstack/react-query";
import { PUBLIC_PROFILE_MAX_AGE_SECONDS } from "./profile-cache";
import { queryKeys } from "./query";
import type { PublicUserWithBadge } from "./types";

// Profile objects that came straight from a server response. Anything else in
// a profile cache entry was written by a patch on this device (a follow, a new
// avatar).
const fromServer = new WeakSet<object>();

export function markProfileFromServer<T>(user: T): T {
  if (typeof user === "object" && user !== null) fromServer.add(user);
  return user;
}

// The Worker caches the profile read, so a fresh response can predate a patch
// this device already wrote into the cache. A patched entry written inside
// the Worker's cache window is kept. A server response already in the cache
// is not: the one just fetched is at least as new.
export function settleLoadedProfile(
  queryClient: QueryClient,
  username: string,
  user: PublicUserWithBadge,
): PublicUserWithBadge {
  const key = queryKeys.userProfile(username);
  const cached = queryClient.getQueryState<PublicUserWithBadge>(key);
  if (
    cached?.data !== undefined &&
    !cached.isInvalidated &&
    !fromServer.has(cached.data) &&
    Date.now() - cached.dataUpdatedAt < PUBLIC_PROFILE_MAX_AGE_SECONDS * 1000
  ) {
    return cached.data;
  }

  queryClient.setQueryData(key, user);
  // Structural sharing can keep the previous object when the two are equal,
  // so mark what was actually stored.
  const stored = queryClient.getQueryData<PublicUserWithBadge>(key) ?? user;
  return markProfileFromServer(stored);
}
