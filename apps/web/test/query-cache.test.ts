import type { InfiniteData } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { patchPostAcrossFeed } from "@/lib/query-cache";
import type { FeedItem, FeedResponse, PostData } from "@/lib/types";

function makeItem(id: string): FeedItem {
  return {
    type: "post",
    post: { id, likeCount: 0, isLiked: false } as unknown as PostData,
  };
}

function makeFeed(ids: string[]): InfiniteData<FeedResponse> {
  return {
    pageParams: [null],
    pages: [{ data: ids.map(makeItem), nextCursor: null }],
  };
}

describe("patchPostAcrossFeed", () => {
  it("applies the update to the matching post", () => {
    const previous = makeFeed(["a", "b"]);
    const next = patchPostAcrossFeed(previous, "a", (post) => ({
      ...post,
      likeCount: 1,
    }));
    expect(next?.pages[0]?.data[0]?.post.likeCount).toBe(1);
  });

  // Identity is the point: PostCard is memoized, so a like tap must not hand
  // every other card a fresh item wrapper and re-render the whole feed.
  it("returns the same item reference for a non-matching post", () => {
    const previous = makeFeed(["a", "b"]);
    const next = patchPostAcrossFeed(previous, "a", (post) => ({
      ...post,
      likeCount: 1,
    }));
    expect(next?.pages[0]?.data[1]).toBe(previous.pages[0]?.data[1]);
  });
});
