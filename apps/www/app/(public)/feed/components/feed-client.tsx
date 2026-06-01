"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ComposeFab } from "@/components/compose-fab";
import type { FeedSort } from "@/lib/feed-sort";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";
import { PostList } from "./post-list";

export function FeedClient({ sort }: { sort: FeedSort }) {
  const router = useRouter();
  const { data: currentUser } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
  });
  const user = currentUser?.user;
  const isAuthResolved = currentUser !== undefined;

  useEffect(() => {
    if (sort === "following" && isAuthResolved && !user) {
      router.replace("/login");
    }
  }, [isAuthResolved, router, sort, user]);

  return (
    <>
      <PostList sort={sort} isAuthenticated={!!user} currentUserId={user?.id} />
      {user && <ComposeFab user={user} />}
    </>
  );
}
