/**
 * Server-only fetchers used by RSC pages that prefetch the public variant
 * of an infinite query and dehydrate it for client hydration.
 *
 * These hit the Hono API directly with ISR caching (`next.revalidate`), so the
 * page can keep `export const revalidate = N` semantics — every cached HTML
 * gen calls Hono once, then serves the result to every visitor in the window.
 *
 * Auth-scoped variants are intentionally absent: those would need a per-request
 * cookie forward and would convert pages to dynamic Vercel functions.
 */
import type { FeedResponse, NotesResponse } from "./query-types";
import { getHonoApiOrigin } from "./server-metadata";

async function getJsonCached<T>(path: string, revalidate: number): Promise<T> {
  const response = await fetch(`${getHonoApiOrigin()}${path}`, {
    headers: { accept: "application/json" },
    next: { revalidate },
  });

  if (!response.ok) {
    throw new Error(`Server fetch failed for ${path}: ${response.status}`);
  }
  return (await response.json()) as T;
}

export function fetchPublicPostsPageServer(revalidate = 60) {
  return getJsonCached<FeedResponse>("/api/public/posts", revalidate);
}

export function fetchPublicNotesPageServer(revalidate = 60) {
  return getJsonCached<NotesResponse>("/api/public/notes", revalidate);
}
