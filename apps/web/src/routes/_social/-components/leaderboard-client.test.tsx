import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  LeaderboardRankResponse,
  LeaderboardResponse,
} from "@/lib/leaderboard";
import { queryKeys } from "@/lib/query";
import { LeaderboardClient } from "./leaderboard-client";

vi.mock("@/lib/query-fetchers", () => ({
  fetchLeaderboardRank: vi.fn(),
}));
vi.mock("../-lib/loader-queries", () => ({
  loaderFetchLeaderboard: vi.fn(),
}));
vi.mock("@/lib/navigation", () => ({
  // oxlint-disable-next-line typescript/no-explicit-any -- test stub
  Link: ({ to, href, children, search: _s, preload: _p, ...rest }: any) => (
    <a href={to ?? href} {...rest}>
      {children}
    </a>
  ),
}));

import { fetchLeaderboardRank } from "@/lib/query-fetchers";

const board: LeaderboardResponse = {
  tab: "aura",
  entries: [
    { id: "a", value: 900 },
    { id: "me", value: 500 },
    { id: "c", value: 500 },
  ].map(({ id, value }, i) => ({
    rank: [1, 2, 2][i],
    value,
    user: {
      id,
      username: `u_${id}`,
      displayName: null,
      imageUrl: null,
      groupBadge: null,
    },
  })),
};

function renderBoard(viewerId: string | null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(queryKeys.leaderboard("aura"), board);
  return render(
    <QueryClientProvider client={queryClient}>
      <LeaderboardClient tab="aura" viewerId={viewerId} />
    </QueryClientProvider>,
  );
}

function mockRank(rank: LeaderboardRankResponse) {
  vi.mocked(fetchLeaderboardRank).mockResolvedValue(rank);
}

describe("LeaderboardClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks only the viewer's own row and keeps tied ranks", async () => {
    mockRank({ rank: 2, value: 500, hidden: false });
    renderBoard("me");

    const rows = screen.getAllByRole("listitem");
    expect(rows.map((row) => row.getAttribute("aria-current"))).toEqual([
      null,
      "true",
      null,
    ]);
    expect(rows.map((row) => row.textContent?.match(/^\d+/)?.[0])).toEqual([
      "1",
      "2",
      "2",
    ]);
    expect(await screen.findByText("#2")).toBeInTheDocument();
  });

  it("says tied when the viewer shares a listed rank but was cut off", async () => {
    mockRank({ rank: 2, value: 500, hidden: false });
    renderBoard("cut");

    expect(await screen.findByText(/tied at/i)).toBeInTheDocument();
  });

  it("doesn't say tied when the viewer's row is listed", async () => {
    mockRank({ rank: 2, value: 500, hidden: false });
    renderBoard("me");

    await screen.findByText("#2");
    expect(screen.queryByText(/tied at/i)).not.toBeInTheDocument();
  });

  it("points a hidden viewer to settings instead of a rank", async () => {
    mockRank({ rank: null, value: 500, hidden: true });
    renderBoard("me");

    expect(
      await screen.findByRole("link", { name: /change this in settings/i }),
    ).toHaveAttribute("href", "/settings");
    expect(screen.queryByText(/^#/)).not.toBeInTheDocument();
  });

  it("tells a ranked-out viewer they're past the cap, not that they have nothing", async () => {
    mockRank({ rank: null, value: 40, hidden: false });
    renderBoard("me");

    expect(
      await screen.findByText(/not in the top 1,000/i),
    ).toBeInTheDocument();
  });

  it("asks a signed-out viewer to sign in and never fetches a rank", () => {
    renderBoard(null);

    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(fetchLeaderboardRank).not.toHaveBeenCalled();
  });
});
