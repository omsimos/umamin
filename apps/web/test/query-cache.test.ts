import type { InfiniteData } from "@tanstack/react-query";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
  patchPostAcrossFeed,
  patchPostEverywhere,
  removePostEverywhere,
} from "@/lib/query-cache";
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

describe("patchPostEverywhere / removePostEverywhere", () => {
  it("patches the same post in the home feed, the profile feed and the post cache", () => {
    const qc = new QueryClient();
    qc.setQueryData(["posts", "latest", "public"], makeFeed(["a", "b"]));
    qc.setQueryData(["user-posts", "josh"], makeFeed(["a"]));
    qc.setQueryData(["post", "a"], {
      id: "a",
      likeCount: 0,
    } as unknown as PostData);

    patchPostEverywhere(qc, "a", (post) => ({ ...post, likeCount: 5 }));

    expect(
      qc.getQueryData<InfiniteData<FeedResponse>>(["posts", "latest", "public"])
        ?.pages[0]?.data[0]?.post.likeCount,
    ).toBe(5);
    expect(
      qc.getQueryData<InfiniteData<FeedResponse>>(["user-posts", "josh"])
        ?.pages[0]?.data[0]?.post.likeCount,
    ).toBe(5);
    expect(qc.getQueryData<PostData>(["post", "a"])?.likeCount).toBe(5);
  });

  it("removes the post from every feed and nulls the post cache", () => {
    const qc = new QueryClient();
    qc.setQueryData(["posts", "latest", "public"], makeFeed(["a", "b"]));
    qc.setQueryData(["user-posts", "josh"], makeFeed(["a"]));
    qc.setQueryData(["post", "a"], { id: "a" } as unknown as PostData);

    removePostEverywhere(qc, "a");

    expect(
      qc
        .getQueryData<InfiniteData<FeedResponse>>(["posts", "latest", "public"])
        ?.pages[0]?.data.map((i) => i.post.id),
    ).toEqual(["b"]);
    expect(
      qc.getQueryData<InfiniteData<FeedResponse>>(["user-posts", "josh"])
        ?.pages[0]?.data,
    ).toEqual([]);
    expect(qc.getQueryData(["post", "a"])).toBeNull();
  });
});
