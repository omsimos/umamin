"use client";

import type { InfiniteData } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import { cn } from "@umamin/ui/lib/utils";
import { CheckCircle2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { votePollAction } from "@/app/actions/post";
import {
  BURST_ACTION_REJECT_MESSAGE,
  useBurstAction,
} from "@/hooks/use-burst-action";
import { vibrate } from "@/lib/haptics";
import {
  isPollEnded,
  POLL_ENDED_ERROR,
  pollPercentages,
  pollTotalVotes,
} from "@/lib/poll";
import { queryKeys } from "@/lib/query";
import { patchPostAcrossFeed, patchPostResponse } from "@/lib/query-cache";
import type { FeedResponse, PostResponse } from "@/lib/query-types";
import { getActionError, isAlreadyVoted, shortTimeUntil } from "@/lib/utils";
import type { PollData, PostData } from "@/types/post";

type PollCardProps = {
  postId: string;
  poll: PollData;
  isAuthenticated: boolean;
};

export function PollCard({ postId, poll, isAuthenticated }: PollCardProps) {
  const queryClient = useQueryClient();

  // undefined myVoteOptionId (public/profile reads carry no overlay) renders
  // the same as null: votable, with the server correcting an alreadyVoted tap.
  const [myVote, setMyVote] = useState<string | null>(
    poll.myVoteOptionId ?? null,
  );
  const [counts, setCounts] = useState<number[]>(
    poll.options.map((option) => option.voteCount),
  );
  // A vote rejected with "poll has ended" flips the card before the client
  // clock agrees — the server is authoritative on expiry.
  const [forceEnded, setForceEnded] = useState(false);

  // Scalar deps only — see post-card.tsx: depending on `poll` itself (a fresh
  // reference on most parent renders) would clobber optimistic state. Counts
  // round-trip through a joined key so the effect resyncs only on real change.
  const countsKey = poll.options.map((option) => option.voteCount).join(".");
  const dataMyVote = poll.myVoteOptionId ?? null;
  useEffect(() => {
    setMyVote(dataMyVote);
    setCounts(countsKey.split(".").map(Number));
  }, [dataMyVote, countsKey]);

  const ended = forceEnded || isPollEnded(poll.endsAt);
  const hasVoted = myVote != null;
  const showResults = hasVoted || ended;
  const total = pollTotalVotes(counts.map((voteCount) => ({ voteCount })));
  const percentages = pollPercentages(
    counts.map((voteCount) => ({ voteCount })),
  );
  const endsIn = shortTimeUntil(poll.endsAt);

  const syncPollCache = (nextVote: string | null, nextCounts: number[]) => {
    // Field-scoped: patches only the poll so concurrent like/repost writes
    // can't be clobbered with stale closure values.
    const patch = (post: PostData): PostData =>
      post.poll
        ? {
            ...post,
            poll: {
              ...post.poll,
              myVoteOptionId: nextVote,
              options: post.poll.options.map((option, i) => ({
                ...option,
                voteCount: nextCounts[i] ?? option.voteCount,
              })),
            },
          }
        : post;

    queryClient.setQueriesData<InfiniteData<FeedResponse>>(
      { queryKey: queryKeys.postsRoot() },
      (current) => patchPostAcrossFeed(current, postId, patch),
    );
    queryClient.setQueryData<PostResponse>(queryKeys.post(postId), (current) =>
      patchPostResponse(current, patch),
    );
  };

  const handleVoteAction = useBurstAction(
    async (optionId: string) => votePollAction({ optionId }),
    { limit: 4, rejectMessage: BURST_ACTION_REJECT_MESSAGE },
  );

  const handleVote = async (optionId: string) => {
    if (!isAuthenticated || hasVoted || ended) return;
    // Optimistic posts carry placeholder option ids until the server swap.
    if (optionId.startsWith("optimistic-")) return;

    // Votes are final and once-per-poll — a consequential tap.
    vibrate(10);

    const prevCounts = counts;
    const optionIndex = poll.options.findIndex(
      (option) => option.id === optionId,
    );
    const nextCounts = counts.map((count, i) =>
      i === optionIndex ? count + 1 : count,
    );

    setMyVote(optionId);
    setCounts(nextCounts);

    try {
      const res = await handleVoteAction(optionId);
      const actionError = getActionError(res);

      if (actionError === POLL_ENDED_ERROR) {
        setMyVote(null);
        setCounts(prevCounts);
        setForceEnded(true);
        toast.info(POLL_ENDED_ERROR);
        return;
      }
      if (actionError) {
        throw new Error(actionError);
      }

      // The vote row already existed (second device / stale profile card):
      // the server's pick is authoritative and the count never moved.
      if (isAlreadyVoted(res)) {
        setCounts(prevCounts);
        setMyVote(res.votedOptionId ?? null);
        syncPollCache(res.votedOptionId ?? null, prevCounts);
        return;
      }

      syncPollCache(optionId, nextCounts);
    } catch (err) {
      setMyVote(null);
      setCounts(prevCounts);
      toast.error(err instanceof Error ? err.message : "Couldn't vote.");
      console.log(err);
    }
  };

  return (
    // z-10 lifts the poll above the card's whole-surface link overlay so taps
    // vote instead of navigating.
    <div className="relative z-10 mt-3 space-y-2">
      <ul className="space-y-2">
        {poll.options.map((option, i) => {
          const pct = percentages[i] ?? 0;
          const isMine = myVote === option.id;

          if (showResults) {
            return (
              <li
                key={option.id}
                role="img"
                aria-label={`${option.label}: ${pct}% (${counts[i] ?? 0} ${
                  (counts[i] ?? 0) === 1 ? "vote" : "votes"
                })`}
              >
                <div className="relative h-9 overflow-hidden rounded-md border">
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 transition-[width] duration-300",
                      isMine ? "bg-pink-500/25" : "bg-muted",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                  <div className="relative flex h-full items-center justify-between gap-2 px-3 text-sm">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate">{option.label}</span>
                      {isMine && (
                        <CheckCircle2Icon className="size-4 shrink-0 text-pink-500" />
                      )}
                    </span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {pct}%
                    </span>
                  </div>
                </div>
              </li>
            );
          }

          return (
            <li key={option.id}>
              <Button
                type="button"
                variant="outline"
                disabled={!isAuthenticated}
                onClick={() => handleVote(option.id)}
                aria-label={`Vote for ${option.label}`}
                // disabled:opacity-100 — same convention as the like/repost
                // buttons: logged-out viewers see full-opacity, inert options.
                className="h-9 w-full justify-start rounded-md font-normal disabled:opacity-100"
              >
                <span className="truncate">{option.label}</span>
              </Button>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-muted-foreground">
        {total} {total === 1 ? "vote" : "votes"}
        {ended || !endsIn ? " · Final results" : ` · ends in ${endsIn}`}
      </p>
    </div>
  );
}
