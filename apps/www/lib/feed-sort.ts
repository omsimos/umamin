export const FEED_SORTS = ["hot", "following", "latest"] as const;

export type FeedSort = (typeof FEED_SORTS)[number];

export const DEFAULT_FEED_SORT: FeedSort = "hot";

export function normalizeFeedSort(value: string | null | undefined): FeedSort {
  return value === "following" || value === "latest"
    ? value
    : DEFAULT_FEED_SORT;
}
