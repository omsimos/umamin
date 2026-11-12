import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  search: { pro: "success" as "success" | undefined },
  fetchUser: vi.fn(),
  callAction: vi.fn(),
  navigate: vi.fn(),
  assign: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  getRouteApi: () => ({
    useSearch: () => mocks.search,
    useNavigate: () => mocks.navigate,
  }),
  Link: () => null,
}));
vi.mock("@/hooks/use-pro-offer", () => ({
  useProOffer: () => true,
}));
vi.mock("@/lib/query-fetchers", () => ({
  fetchCurrentUserOptional: mocks.fetchUser,
}));
vi.mock("@/lib/api", () => ({ callAction: mocks.callAction }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/lib/reload-page", () => ({
  assignLocation: mocks.assign,
  reloadPage: vi.fn(),
}));

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

const BASELINE_KEY = "umamin-pro:checkoutBaseline";
const DAY_MS = 86_400_000;

function resetMocks() {
  vi.useFakeTimers();
  sessionStorage.clear();
  mocks.search.pro = "success";
  mocks.fetchUser.mockReset();
  mocks.fetchUser.mockResolvedValue({ user: { ...BUYER } });
  mocks.navigate.mockReset();
  mocks.assign.mockReset();
  mocks.callAction.mockReset();
}

describe("TiersView after checkout", () => {
  beforeEach(resetMocks);

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

describe("TiersView renewals", () => {
  beforeEach(resetMocks);

  afterEach(() => {
    vi.useRealTimers();
  });

  const oldUntil = () => new Date(Date.now() + 30 * DAY_MS).toISOString();
  const newUntil = () => new Date(Date.now() + 210 * DAY_MS).toISOString();

  it("keeps a renewal waiting until Pro extends", async () => {
    const OLD_UNTIL = oldUntil();
    const NEW_UNTIL = newUntil();
    sessionStorage.setItem(BASELINE_KEY, String(new Date(OLD_UNTIL).getTime()));
    mocks.fetchUser.mockResolvedValue({
      user: { ...BUYER, proUntil: OLD_UNTIL },
    });

    renderTiers();
    await advance(1_000);
    expect(buyButton()).toBeDisabled();
    expect(screen.getByText(/Payment received/)).toBeInTheDocument();

    const before = mocks.fetchUser.mock.calls.length;
    await advance(3_000);
    expect(mocks.fetchUser.mock.calls.length).toBeGreaterThan(before);

    mocks.fetchUser.mockResolvedValue({
      user: { ...BUYER, proUntil: NEW_UNTIL },
    });
    await advance(4_000);
    expect(buyButton()).toBeEnabled();
    expect(screen.queryByText(/Payment received/)).not.toBeInTheDocument();
    expect(sessionStorage.getItem(BASELINE_KEY)).toBeNull();
  });

  it("confirms at once when the renewal landed before the return", async () => {
    sessionStorage.setItem(
      BASELINE_KEY,
      String(new Date(oldUntil()).getTime()),
    );
    mocks.fetchUser.mockResolvedValue({
      user: { ...BUYER, proUntil: newUntil() },
    });

    renderTiers();
    await advance(1_000);
    expect(buyButton()).toBeEnabled();
  });

  it("treats any active Pro as confirmed when no baseline was saved", async () => {
    mocks.fetchUser.mockResolvedValue({
      user: { ...BUYER, proUntil: oldUntil() },
    });

    renderTiers();
    await advance(1_000);
    expect(buyButton()).toBeEnabled();
  });
});

describe("TiersView checkout button", () => {
  const CHECKOUT_URL = "https://pay.example/checkout";

  beforeEach(() => {
    resetMocks();
    mocks.search.pro = undefined;
    mocks.callAction.mockResolvedValue({ url: CHECKOUT_URL });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function startCheckout() {
    renderTiers();
    await advance(1_000);
    // Without a checkout return or active Pro the page opens on another tab.
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Pro" }));
    await act(async () => {
      buyButton().click();
    });
    await advance(0);
  }

  async function showPage(persisted: boolean) {
    const event = new Event("pageshow");
    if (persisted) Object.defineProperty(event, "persisted", { value: true });
    act(() => {
      window.dispatchEvent(event);
    });
    // React Query batches the reset notification on a zero-delay timer.
    await advance(0);
  }

  it("saves the Pro horizon before leaving for checkout", async () => {
    await startCheckout();

    expect(mocks.assign).toHaveBeenCalledWith(CHECKOUT_URL);
    expect(sessionStorage.getItem(BASELINE_KEY)).toBe("0");
  });

  it("re-enables the button when the page is restored from the back-forward cache", async () => {
    await startCheckout();
    expect(buyButton()).toBeDisabled();
    await showPage(true);
    expect(buyButton()).toBeEnabled();

    cleanup();
    await startCheckout();
    expect(buyButton()).toBeDisabled();
    await showPage(false);
    expect(buyButton()).toBeDisabled();
  });
});
