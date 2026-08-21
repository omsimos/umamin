import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const fetchFeatureFlags = vi.fn();
const loaderFetchJson = vi.fn();

vi.mock("@/lib/query-fetchers", () => ({ fetchFeatureFlags }));
vi.mock("@/lib/loader-fetch", () => ({ loaderFetchJson }));

const { useFeatureFlags } = await import("@/hooks/use-feature-flags");
const { loadFeatureFlags } = await import("@/lib/loader-flags");

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
  // paint the Pro offer on every page load until the fetch resolved.
  it("reads as hidden before the flags arrive", () => {
    fetchFeatureFlags.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });
    expect(result.current).toEqual({ pro: false });
  });

  it("reads as hidden when the request fails", async () => {
    fetchFeatureFlags.mockRejectedValue(new Error("flags down"));
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });
    await waitFor(() => {
      expect(fetchFeatureFlags).toHaveBeenCalled();
    });
    expect(result.current).toEqual({ pro: false });
  });

  it("passes through a resolved flag", async () => {
    fetchFeatureFlags.mockResolvedValue({ pro: true });
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });
    await waitFor(() => {
      expect(result.current).toEqual({ pro: true });
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
      pro: false,
    });
  });
});
