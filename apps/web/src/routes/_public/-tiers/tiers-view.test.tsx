import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  search: { pro: "success" as "success" | undefined },
  fetchUser: vi.fn(),
  callAction: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  getRouteApi: () => ({
    useSearch: () => mocks.search,
    useNavigate: () => mocks.navigate,
  }),
  Link: () => null,
}));
vi.mock("@/hooks/use-feature-flags", () => ({
  useFeatureFlags: () => ({ pro: true }),
}));
vi.mock("@/lib/query-fetchers", () => ({
  fetchCurrentUserOptional: mocks.fetchUser,
}));
vi.mock("@/lib/api", () => ({ callAction: mocks.callAction }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { TiersView } from "./tiers-view";

const BUYER = {
  id: "buyer",
  username: "buyer",
  createdAt: new Date().toISOString(),
  proUntil: null as string | null,
};

function renderTiers() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <TiersView />
    </QueryClientProvider>,
  );
}

const buyButton = () =>
  screen.getByRole("button", { name: /Pro: ₱|more months/ });

// Flushes the query's resolved fetch and React's re-render.
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

describe("TiersView after checkout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.search.pro = "success";
    mocks.fetchUser.mockReset();
    mocks.fetchUser.mockResolvedValue({ user: { ...BUYER } });
    mocks.navigate.mockReset();
  });

  const strippedMarker = () =>
    mocks.navigate.mock.calls.some(
      ([opts]) => opts?.replace === true && opts?.search?.pro === undefined,
    );

  afterEach(() => {
    vi.useRealTimers();
  });

  it("disables buying again while the order is awaiting confirmation", async () => {
    renderTiers();
    // Long enough for the user to load, short of the first poll.
    await advance(1_000);

    expect(mocks.fetchUser).toHaveBeenCalled();
    expect(buyButton()).toBeDisabled();
  });

  it("polls until Pro arrives, then shows it active", async () => {
    renderTiers();
    await advance(0);
    const callsAtStart = mocks.fetchUser.mock.calls.length;

    await advance(3_000);
    await advance(3_000);
    expect(mocks.fetchUser.mock.calls.length).toBeGreaterThanOrEqual(
      callsAtStart + 2,
    );

    const proUntil = new Date(Date.now() + 1e10).toISOString();
    mocks.fetchUser.mockResolvedValue({ user: { ...BUYER, proUntil } });
    // The next poll, plus a beat for the query to settle and re-render.
    await advance(4_000);

    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(buyButton()).toBeEnabled();
    expect(strippedMarker()).toBe(true);

    const settled = mocks.fetchUser.mock.calls.length;
    await advance(30_000);
    expect(mocks.fetchUser.mock.calls.length).toBe(settled);
  });

  it("stops polling after two minutes and says what to do", async () => {
    renderTiers();
    await advance(0);

    await advance(2 * 60_000);
    expect(screen.getByText(/email umamin@omsimos.com/)).toBeInTheDocument();
    expect(buyButton()).toBeDisabled();
    // A reload or a revisit from history must not lock the button again.
    expect(strippedMarker()).toBe(true);

    const settled = mocks.fetchUser.mock.calls.length;
    await advance(30_000);
    expect(mocks.fetchUser.mock.calls.length).toBe(settled);
  });

  it("keeps the marker in the URL while confirmation is pending", async () => {
    renderTiers();
    await advance(1_000);

    expect(buyButton()).toBeDisabled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("keeps the wait after the marker leaves the URL", async () => {
    renderTiers();
    await advance(2 * 60_000);
    expect(strippedMarker()).toBe(true);

    // The router drops ?pro=success; the view still knows it came from
    // checkout, so "Check again" resumes polling.
    mocks.search.pro = undefined;
    await act(async () => {
      screen.getByRole("button", { name: "Check again" }).click();
    });
    expect(buyButton()).toBeDisabled();
    const before = mocks.fetchUser.mock.calls.length;
    await advance(3_000);
    expect(mocks.fetchUser.mock.calls.length).toBeGreaterThan(before);
  });

  it("doesn't poll without a checkout return", async () => {
    mocks.search.pro = undefined;
    renderTiers();
    await advance(1_000);

    const settled = mocks.fetchUser.mock.calls.length;
    await advance(30_000);
    expect(mocks.fetchUser.mock.calls.length).toBe(settled);
  });
});
