"use client";

import { ComposeFab } from "@/components/compose-fab";
import type { FeedSort } from "@/lib/feed-sort";
import { PostList } from "./post-list";

// The viewer is resolved on the server (see feed/page.tsx) and passed in, so
// the list renders under the correct viewer key from the first paint — no
// client /api/me round trip before page 1, and no second full-page fetch.
export function FeedClient({
  sort,
  initialUserId,
  isAuthenticated,
}: {
  sort: FeedSort;
  initialUserId: string | null;
  isAuthenticated: boolean;
}) {
  return (
    <>
      <PostList
        sort={sort}
        isAuthenticated={isAuthenticated}
        currentUserId={initialUserId ?? undefined}
      />
      {isAuthenticated && <ComposeFab />}
    </>
  );
}
