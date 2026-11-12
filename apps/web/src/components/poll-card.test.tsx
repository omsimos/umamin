import {
  type InfiniteData,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { votePollAction } from "@/lib/actions";
import type { FeedResponse, PollData, PostData } from "@/lib/types";
import { PollCard } from "./poll-card";

vi.mock("@/lib/actions", () => ({ votePollAction: vi.fn() }));

const SERVER_NOW = new Date("2026-11-05T10:00:00Z").getTime();
const ENDS_AT = new Date(SERVER_NOW + 5 * 60_000);

const poll: PollData = {
  endsAt: ENDS_AT,
  options: [
    { id: "a", label: "Yes", voteCount: 3 },
    { id: "b", label: "No", voteCount: 1 },
  ] as PollData["options"],
  myVoteOptionId: null,
};

function card() {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <PollCard postId="p1" poll={poll} isAuthenticated />
    </QueryClientProvider>
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("PollCard clock", () => {
  // The server's clock and the phone's disagree (skew, or simply the time
  // the HTML spent in flight), so the card used to hydrate "ends in 5m"
  // against a client that already considered the poll over.
  it("hydrates without a mismatch when the poll ended in transit", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SERVER_NOW);
    const container = document.createElement("div");
    container.innerHTML = renderToString(card());
    document.body.appendChild(container);

    vi.setSystemTime(SERVER_NOW + 10 * 60_000);
    const onRecoverableError = vi.fn();
    await act(async () => {
      hydrateRoot(container, card(), { onRecoverableError });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Final results");
    container.remove();
  });

  it("renders no countdown and inert options on the server", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SERVER_NOW);
    const container = document.createElement("div");
    container.innerHTML = renderToString(card());

    expect(container.textContent).not.toMatch(/ends in|Final results/);
    for (const button of container.querySelectorAll("button")) {
      expect(button).toBeDisabled();
    }
  });

  it("shows the countdown and live options once on the client", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SERVER_NOW);
    render(card());

    expect(screen.getByText(/ends in 5m/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vote for Yes" })).toBeEnabled();
  });
});

describe("PollCard vote", () => {
  it("writes a vote into the profile feed cache", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SERVER_NOW);
    const queryClient = new QueryClient();
    const key = ["user-posts", "josh"];
    queryClient.setQueryData<InfiniteData<FeedResponse>>(key, {
      pageParams: [null],
      pages: [
        {
          data: [
            {
              type: "post",
              post: { id: "p1", poll } as unknown as PostData,
            },
          ],
          nextCursor: null,
        },
      ] as FeedResponse[],
    });
    vi.mocked(votePollAction).mockResolvedValue({
      success: true,
      votedOptionId: "a",
    } as never);

    render(
      <QueryClientProvider client={queryClient}>
        <PollCard postId="p1" poll={poll} isAuthenticated />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Vote for Yes" }));
    await act(async () => {});

    const cachedPoll =
      queryClient.getQueryData<InfiniteData<FeedResponse>>(key)?.pages[0]
        ?.data[0]?.post.poll;
    expect(cachedPoll?.myVoteOptionId).toBe("a");
    expect(
      cachedPoll?.options.find((option) => option.id === "a")?.voteCount,
    ).toBe(4);
  });
});
