import "server-only";

import type { SelectPost } from "@umamin/db/schema/post";

/**
 * Static Hot score shared by the Redis zset and the SQL fallback so both
 * paths agree on ordering. Deliberately time-independent (no "now" input):
 * a post's score only changes when its counters change, which keeps the
 * zset incrementally maintainable — no re-score sweeps.
 *
 * 1 score unit = 10s of recency; log1p dampens engagement so heavy posts
 * can't runaway-pin (E=10 → ~10h above a fresh post, E=100 → ~19h,
 * E=1000 → ~29h; linear scoring pinned E=100 for ~11 days).
 */
export const HOT_SCORE_K = 1500;

// Max scoreKey gap (= 2h of recency-equivalent) a different-author candidate
// may bridge when promoted past a same-author run. The old relative
// threshold (0.85×) is meaningless against epoch-scale scores.
export const HOT_DIVERSIFY_MAX_GAP = 720;

export type HotRankablePost = Pick<
  SelectPost,
  "createdAt" | "likeCount" | "pollVoteCount" | "commentCount" | "repostCount"
>;

export function getHotEngagement(post: HotRankablePost) {
  return (
    post.likeCount +
    post.pollVoteCount +
    post.commentCount * 3 +
    post.repostCount * 4
  );
}

// Float — what the Redis zset stores.
export function getHotScore(post: HotRankablePost) {
  return (
    post.createdAt.getTime() / 10_000 +
    Math.log1p(getHotEngagement(post)) * HOT_SCORE_K
  );
}

// Rounded int — what cursors, comparisons, and diversification use. Sub-10s
// ordering loss is covered by the createdAt/postId cursor tiebreaks.
export function getHotScoreKey(post: HotRankablePost) {
  return Math.round(getHotScore(post));
}

/**
 * Page-local same-author spacing: when two adjacent candidates share an
 * author, promote the nearest different-author candidate from the next four
 * slots — but only if it ranks within HOT_DIVERSIFY_MAX_GAP, so
 * diversification never surfaces meaningfully colder content.
 */
export function diversifyHotCandidates<
  T extends { post: Pick<SelectPost, "authorId">; scoreKey: number },
>(candidates: T[]) {
  const result = [...candidates];

  for (let index = 1; index < result.length; index += 1) {
    const previous = result[index - 1];
    const current = result[index];

    if (previous.post.authorId !== current.post.authorId) {
      continue;
    }

    const replacementIndex = result.findIndex(
      (candidate, candidateIndex) =>
        candidateIndex > index &&
        candidateIndex <= index + 4 &&
        candidate.post.authorId !== previous.post.authorId &&
        candidate.scoreKey >= current.scoreKey - HOT_DIVERSIFY_MAX_GAP,
    );

    if (replacementIndex === -1) {
      continue;
    }

    const [replacement] = result.splice(replacementIndex, 1);
    result.splice(index, 0, replacement);
  }

  return result;
}
