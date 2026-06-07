import { describe, expect, it } from "vitest";
import {
  diversifyHotCandidates,
  getHotEngagement,
  getHotScore,
  getHotScoreKey,
  HOT_DIVERSIFY_MAX_GAP,
  type HotRankablePost,
} from "./hot-score";

const HOUR_MS = 3_600_000;

function makePost(overrides: Partial<HotRankablePost> = {}): HotRankablePost {
  return {
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    likeCount: 0,
    pollVoteCount: 0,
    commentCount: 0,
    repostCount: 0,
    ...overrides,
  };
}

describe("getHotEngagement", () => {
  it("weights likes and poll votes at 1, comments at 3, reposts at 4", () => {
    expect(getHotEngagement(makePost({ likeCount: 1 }))).toBe(1);
    expect(getHotEngagement(makePost({ pollVoteCount: 1 }))).toBe(1);
    expect(getHotEngagement(makePost({ commentCount: 1 }))).toBe(3);
    expect(getHotEngagement(makePost({ repostCount: 1 }))).toBe(4);
    expect(
      getHotEngagement(
        makePost({
          likeCount: 2,
          pollVoteCount: 3,
          commentCount: 4,
          repostCount: 5,
        }),
      ),
    ).toBe(2 + 3 + 4 * 3 + 5 * 4);
  });
});

describe("getHotScore", () => {
  it("scores a zero-engagement post on recency alone", () => {
    const post = makePost();
    expect(getHotScore(post)).toBe(post.createdAt.getTime() / 10_000);
  });

  it("dampens engagement: the first like is worth far more than the 101st", () => {
    const at = (likeCount: number) => getHotScore(makePost({ likeCount }));
    const firstLike = at(1) - at(0);
    const hundredFirstLike = at(101) - at(100);

    expect(firstLike).toBeGreaterThan(hundredFirstLike * 50);
  });

  it("lets an E=100 post pin for ~19h, not days", () => {
    const engaged = makePost({ likeCount: 100 });
    const freshAfter = (hours: number) =>
      makePost({
        createdAt: new Date(engaged.createdAt.getTime() + hours * HOUR_MS),
      });

    // log1p(100)*1500 units * 10s ≈ 19.23h crossover.
    expect(getHotScore(engaged)).toBeGreaterThan(getHotScore(freshAfter(19.2)));
    expect(getHotScore(engaged)).toBeLessThan(getHotScore(freshAfter(19.3)));
  });
});

describe("getHotScoreKey", () => {
  it("is the rounded score", () => {
    const post = makePost({ likeCount: 7 });
    expect(getHotScoreKey(post)).toBe(Math.round(getHotScore(post)));
    expect(Number.isSafeInteger(getHotScoreKey(post))).toBe(true);
  });
});

describe("diversifyHotCandidates", () => {
  function candidate(author: string, scoreKey: number) {
    return { post: { authorId: author }, scoreKey };
  }

  it("promotes a near-score different author past a same-author run", () => {
    const result = diversifyHotCandidates([
      candidate("a", 10_000),
      candidate("a", 9_900),
      candidate("b", 9_900 - HOT_DIVERSIFY_MAX_GAP + 1),
    ]);

    expect(result.map((c) => c.post.authorId)).toEqual(["a", "b", "a"]);
  });

  it("leaves the run alone when the only alternate is too far below", () => {
    const result = diversifyHotCandidates([
      candidate("a", 10_000),
      candidate("a", 9_900),
      candidate("b", 9_900 - HOT_DIVERSIFY_MAX_GAP - 1),
    ]);

    expect(result.map((c) => c.post.authorId)).toEqual(["a", "a", "b"]);
  });

  it("only looks four slots ahead for a replacement", () => {
    // The alternate (index 6) sits past the first pair's window (2..5), so
    // it mends the adjacency at index 2 (window 3..6), not the first one.
    const result = diversifyHotCandidates([
      candidate("a", 10_000),
      candidate("a", 9_990),
      candidate("a", 9_980),
      candidate("a", 9_970),
      candidate("a", 9_960),
      candidate("a", 9_950),
      candidate("b", 9_940),
    ]);

    expect(result.map((c) => c.post.authorId)).toEqual([
      "a",
      "a",
      "b",
      "a",
      "a",
      "a",
      "a",
    ]);
  });

  it("does not reorder when authors already alternate", () => {
    const candidates = [
      candidate("a", 10_000),
      candidate("b", 9_900),
      candidate("a", 9_800),
    ];

    expect(diversifyHotCandidates(candidates)).toEqual(candidates);
  });
});
