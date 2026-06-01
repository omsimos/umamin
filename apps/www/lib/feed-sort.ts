export const FEED_SORTS = ["hot", "latest"] as const;

export type FeedSort = (typeof FEED_SORTS)[number];

export const DEFAULT_FEED_SORT: FeedSort = "hot";

export function normalizeFeedSort(value: string | null | undefined): FeedSort {
  return value === "latest" ? "latest" : DEFAULT_FEED_SORT;
}
