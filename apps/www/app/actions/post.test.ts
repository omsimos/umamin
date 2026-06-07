import { beforeEach, describe, expect, it, vi } from "vitest";

const updateTag = vi.fn();
vi.mock("next/cache", () => ({
  updateTag: (tag: string) => updateTag(tag),
  revalidateTag: vi.fn(),
}));

// Mutable per-test fixtures consumed by the db mock's chain stubs.
const state = {
  target: [] as unknown[],
  insertedVote: [] as unknown[],
  existingVote: [] as unknown[],
};
const voteInsertValues = vi.fn();
// Captures (table, values) for each tx.update — the fresh-vote path bumps
// poll_option.voteCount and postTable.pollVoteCount in one transaction.
const countUpdate = vi.fn();

vi.mock("@umamin/db", () => ({
  db: {
    // The option→post derivation read (select → from → innerJoin → where → limit).
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            limit: () => Promise.resolve(state.target),
          }),
        }),
      }),
    }),
    transaction: async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        insert: () => ({
          values: (row: unknown) => {
            voteInsertValues(row);
            return {
              onConflictDoNothing: () => ({
                returning: () => Promise.resolve(state.insertedVote),
              }),
            };
          },
        }),
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve(state.existingVote),
            }),
          }),
        }),
        update: (table: unknown) => ({
          set: (values: unknown) => ({
            where: () => {
              countUpdate(table, values);
              return Promise.resolve();
            },
          }),
        }),
      }),
  },
}));

const getSession = vi.fn();
vi.mock("@/lib/auth", () => ({
  getSession: () => getSession(),
}));

const checkRateLimit = vi.fn();
vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
  RATE_LIMIT_ERROR: "Too many requests",
}));

const notify = vi.fn();
vi.mock("@/lib/server/notifications", () => ({
  notify: (params: unknown) => notify(params),
}));

// Module-level imports of actions/post.ts that must not touch env/Redis/R2.
vi.mock("@/lib/server/data", () => ({ getPostById: vi.fn() }));
vi.mock("@/lib/server/feed-rank", () => ({
  refreshHotPostRank: vi.fn(),
  removeHotPostRank: vi.fn(),
}));
vi.mock("@/lib/redis", () => ({ redis: null }));
vi.mock("@/lib/server/r2", () => ({
  claimStagedImages: vi.fn(),
  deletePostImages: vi.fn(),
  isR2Configured: () => false,
}));

import { pollOptionTable, postTable } from "@umamin/db/schema/post";
import { POLL_ENDED_ERROR } from "@/lib/poll";
import { refreshHotPostRank } from "@/lib/server/feed-rank";
import { votePollAction } from "./post";

const HOUR_MS = 60 * 60 * 1000;

function openTarget() {
  return {
    postId: "post-1",
    authorId: "author-1",
    content: "the question",
    pollEndsAt: new Date(Date.now() + HOUR_MS),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.target = [];
  state.insertedVote = [];
  state.existingVote = [];
  getSession.mockResolvedValue({
    session: { userId: "viewer-1" },
    user: null,
  });
  checkRateLimit.mockResolvedValue(true);
});

describe("votePollAction", () => {
  it("records a fresh vote, bumps the count, and busts the right tags", async () => {
    state.target = [openTarget()];
    state.insertedVote = [{ id: "vote-1" }];

    const res = await votePollAction({ optionId: "opt-1" });

    expect(res).toEqual({ success: true, votedOptionId: "opt-1" });
    expect(voteInsertValues).toHaveBeenCalledWith({
      postId: "post-1",
      optionId: "opt-1",
      userId: "viewer-1",
    });
    // Option count first, then the post's denormalized poll-vote total.
    expect(countUpdate.mock.calls.map(([table]) => table)).toEqual([
      pollOptionTable,
      postTable,
    ]);
    expect(updateTag).toHaveBeenCalledWith("post:post-1");
    expect(updateTag).toHaveBeenCalledWith("post:post-1:poll-voted:viewer-1");
    // Never the shared feed cache — vote counts are eventually consistent.
    expect(updateTag).not.toHaveBeenCalledWith("posts");
    // Votes feed the Hot engagement score.
    expect(refreshHotPostRank).toHaveBeenCalledExactlyOnceWith("post-1");
    expect(notify).toHaveBeenCalledWith({
      recipientId: "author-1",
      type: "vote",
      targetId: "post-1",
      actorId: "viewer-1",
      preview: "the question",
    });
  });

  it("returns the existing pick on a duplicate vote without counting or notifying", async () => {
    state.target = [openTarget()];
    state.insertedVote = []; // unique(postId,userId) conflict
    state.existingVote = [{ optionId: "opt-2" }];

    const res = await votePollAction({ optionId: "opt-1" });

    expect(res).toEqual({
      success: true,
      alreadyVoted: true,
      votedOptionId: "opt-2",
    });
    expect(countUpdate).not.toHaveBeenCalled();
    expect(refreshHotPostRank).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("rejects a vote on an ended poll before any write", async () => {
    state.target = [{ ...openTarget(), pollEndsAt: new Date(Date.now() - 1) }];

    const res = await votePollAction({ optionId: "opt-1" });

    expect(res).toEqual({ error: POLL_ENDED_ERROR });
    expect(voteInsertValues).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("rejects a post without a poll", async () => {
    state.target = [{ ...openTarget(), pollEndsAt: null }];

    const res = await votePollAction({ optionId: "opt-1" });

    expect(res).toEqual({ error: POLL_ENDED_ERROR });
    expect(voteInsertValues).not.toHaveBeenCalled();
  });

  it("errors when the option does not resolve to a post", async () => {
    state.target = [];

    const res = await votePollAction({ optionId: "opt-unknown" });

    expect(res).toEqual({ error: "This poll is no longer available." });
    expect(voteInsertValues).not.toHaveBeenCalled();
  });

  it("rate limits before reading anything", async () => {
    checkRateLimit.mockResolvedValue(false);

    const res = await votePollAction({ optionId: "opt-1" });

    expect(res).toEqual({ error: "Too many requests" });
    expect(voteInsertValues).not.toHaveBeenCalled();
  });
});
