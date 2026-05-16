"use cache";

/**
 * Server-only prefetchers used by RSC pages. They return a dehydrated React
 * Query state ready to feed into <HydrationBoundary>, or null if the Hono
 * origin isn't configured / is unreachable.
 *
 * Each function is wrapped in `use cache` with a 5-minute revalidate so the
 * page stays prerendered under `cacheComponents` and only hits Hono on cache
 * revalidation, not per request.
 *
 * Returning null instead of throwing keeps the cache result deterministic:
 * a build without `HONO_API_ORIGIN` (or a brief Hono outage during ISR) ends
 * up with no dehydrated state and the client falls back to its normal fetch.
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

async function getJson<T>(path: string): Promise<T | null> {
  const origin = getHonoApiOrigin();
  if (!origin) return null;

  try {
    const response = await fetch(`${origin}${path}`, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getDehydratedPublicFeed(): Promise<DehydratedState | null> {
  cacheLife({ revalidate: 300, expire: 3600 });
  const firstPage = await getJson<FeedResponse>("/api/public/posts");
  if (!firstPage) return null;
  const queryClient = getQueryClient();
  queryClient.setQueryData(queryKeys.posts("public"), {
    pages: [firstPage],
    pageParams: [null],
  });
  return dehydrate(queryClient);
}

export async function getDehydratedPublicNotes(): Promise<DehydratedState | null> {
  cacheLife({ revalidate: 300, expire: 3600 });
  const firstPage = await getJson<NotesResponse>("/api/public/notes");
  if (!firstPage) return null;
  const queryClient = getQueryClient();
  queryClient.setQueryData(queryKeys.notes("public"), {
    pages: [firstPage],
    pageParams: [null],
  });
  return dehydrate(queryClient);
}
