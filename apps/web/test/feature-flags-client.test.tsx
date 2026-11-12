import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchFeatureFlags = vi.fn();
const fetchProOffer = vi.fn();
const loaderFetchJson = vi.fn();

vi.mock("@/lib/query-fetchers", () => ({ fetchFeatureFlags, fetchProOffer }));
vi.mock("@/lib/loader-fetch", () => ({ loaderFetchJson }));

const { useFeatureFlags } = await import("@/hooks/use-feature-flags");
const { useProOffer } = await import("@/hooks/use-pro-offer");
const { loadFeatureFlags, loadProOffer } = await import("@/lib/loader-flags");

beforeEach(() => {
  fetchFeatureFlags.mockReset();
  fetchProOffer.mockReset();
  loaderFetchJson.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useFeatureFlags", () => {
  // The anti-flash invariant. Every flag here gates a surface that is currently
  // OFF, so the pre-data default has to be hidden — defaulting to visible would
  // paint a gated surface on every page load until the fetch resolved.
  it("reads as hidden before the flags arrive", () => {
    fetchFeatureFlags.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });
    expect(result.current).toEqual({
      contentModeration: false,
      chat: false,
      dm: false,
    });
  });

  it("reads as hidden when the request fails", async () => {
    fetchFeatureFlags.mockRejectedValue(new Error("flags down"));
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });
    await waitFor(() => {
      expect(fetchFeatureFlags).toHaveBeenCalled();
    });
    expect(result.current).toEqual({
      contentModeration: false,
      chat: false,
      dm: false,
    });
  });

  it("passes through a resolved flag", async () => {
    fetchFeatureFlags.mockResolvedValue({
      contentModeration: true,
      chat: true,
      dm: true,
    });
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });
    await waitFor(() => {
      expect(result.current).toEqual({
        contentModeration: true,
        chat: true,
        dm: true,
      });
    });
  });
});

describe("loadFeatureFlags", () => {
  // A cosmetic gate must not be able to fail a whole route: the loader throwing
  // would render the route's errorComponent instead of the page.
  it("resolves to hidden instead of throwing when the read fails", async () => {
    loaderFetchJson.mockRejectedValue(new Error("flags down"));
    const queryClient = new QueryClient();
    await expect(loadFeatureFlags(queryClient)).resolves.toEqual({
      contentModeration: false,
      chat: false,
      dm: false,
    });
  });

  // The global read must not carry the per-viewer Pro flag, or every page that
  // gates on chat or dm waits on a per-user PostHog lookup again.
  it("requests the global route, with no pro key in its hidden default", async () => {
    loaderFetchJson.mockRejectedValue(new Error("flags down"));
    const flags = await loadFeatureFlags(new QueryClient());
    expect(loaderFetchJson).toHaveBeenCalledWith("/api/flags");
    expect(flags).not.toHaveProperty("pro");
  });
});

describe("useProOffer", () => {
  // The Pro offer is unlaunched in production, so painting it before the
  // answer arrives would flash a purchase entry point on every load.
  it("reads as hidden before the answer arrives", () => {
    fetchProOffer.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useProOffer(), { wrapper });
    expect(result.current).toBe(false);
  });

  it("reads as hidden when the request fails", async () => {
    fetchProOffer.mockRejectedValue(new Error("flags down"));
    const { result } = renderHook(() => useProOffer(), { wrapper });
    await waitFor(() => {
      expect(fetchProOffer).toHaveBeenCalled();
    });
    expect(result.current).toBe(false);
  });

  it("reads as launched when the viewer gets the offer", async () => {
    fetchProOffer.mockResolvedValue({ pro: true });
    const { result } = renderHook(() => useProOffer(), { wrapper });
    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });
});

describe("loadProOffer", () => {
  it("resolves to hidden instead of throwing when the read fails", async () => {
    loaderFetchJson.mockRejectedValue(new Error("flags down"));
    await expect(loadProOffer(new QueryClient())).resolves.toBe(false);
    expect(loaderFetchJson).toHaveBeenCalledWith("/api/flags/pro");
  });

  it("primes the query the hook reads, so the first render has the answer", async () => {
    loaderFetchJson.mockResolvedValue({ pro: true });
    const queryClient = new QueryClient();
    await expect(loadProOffer(queryClient)).resolves.toBe(true);

    fetchProOffer.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useProOffer(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    });
    expect(result.current).toBe(true);
  });
});
