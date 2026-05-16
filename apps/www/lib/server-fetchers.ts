"use cache";

/**
 * Server-only prefetchers used by RSC pages. They return a dehydrated React
 * Query state ready to feed into <HydrationBoundary>.
 *
 * Each function is wrapped in `use cache` with a 5-minute revalidate so the
 * page stays prerendered under `cacheComponents` and only hits Hono on cache
 * revalidation, not per request. Both the network fetch and the QueryClient
 * timestamp work happen inside the cache scope, so the result is a pure
 * serializable object suitable for prerendering.
 *
 * Auth-scoped variants are intentionally absent: those would need a per-
 * request cookie forward and would convert pages to dynamic functions.
 */
import { type DehydratedState, dehydrate } from "@tanstack/react-query";
import { cacheLife } from "next/cache";
import { getQueryClient } from "./get-query-client";
import { queryKeys } from "./query";
import type { FeedResponse, NotesResponse } from "./query-types";
import { getHonoApiOrigin } from "./server-metadata";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${getHonoApiOrigin()}${path}`, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Server fetch failed for ${path}: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function getDehydratedPublicFeed(): Promise<DehydratedState> {
  cacheLife({ revalidate: 300, expire: 3600 });
  const firstPage = await getJson<FeedResponse>("/api/public/posts");
  const queryClient = getQueryClient();
  queryClient.setQueryData(queryKeys.posts("public"), {
    pages: [firstPage],
    pageParams: [null],
  });
  return dehydrate(queryClient);
}

export async function getDehydratedPublicNotes(): Promise<DehydratedState> {
  cacheLife({ revalidate: 300, expire: 3600 });
  const firstPage = await getJson<NotesResponse>("/api/public/notes");
  const queryClient = getQueryClient();
  queryClient.setQueryData(queryKeys.notes("public"), {
    pages: [firstPage],
    pageParams: [null],
  });
  return dehydrate(queryClient);
}
