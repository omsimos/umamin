import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Under jsdom loadViewer takes the client branch (fetch /api/me); the SSR
// cookie check is the one piece swapped per test.
const cookiePresent = vi.hoisted(() => vi.fn<() => Promise<boolean | null>>());
vi.mock("@/lib/loader-fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/loader-fetch")>()),
  ssrSessionCookiePresent: cookiePresent,
}));

import { loadViewer, loadViewerId } from "@/lib/loader-viewer";
import { queryKeys } from "@/lib/query";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";

function respondWith(status: number, body: unknown = {}) {
  const fetchMock = vi.fn(async () => Response.json(body, { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("loadViewer", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    cookiePresent.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("primes the signed-out answer when there is no session cookie", async () => {
    cookiePresent.mockResolvedValue(false);
    const fetchMock = respondWith(401);

    expect(await loadViewer(queryClient)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    // Must match what a real 401 resolves to, so the components that read
    // this key see a settled signed-out viewer and don't fetch /api/me.
    const primed = queryClient.getQueryState(queryKeys.currentUser());
    expect(primed?.status).toBe("success");
    expect(primed?.data).toEqual(await fetchCurrentUserOptional());
  });

  it("renders as signed out on a 5xx without caching it as signed out", async () => {
    respondWith(502);

    expect(await loadViewer(queryClient)).toBeNull();
    expect(await loadViewerId(queryClient)).toBeNull();

    const state = queryClient.getQueryState(queryKeys.currentUser());
    expect(state?.status).toBe("error");
    expect(state?.data).toBeUndefined();
  });

  it("renders as signed out when the request itself fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    expect(await loadViewer(queryClient)).toBeNull();
  });

  it("rethrows a 5xx when strict", async () => {
    respondWith(503);

    await expect(loadViewer(queryClient, { strict: true })).rejects.toThrow(
      "503",
    );
  });

  it("still fails on a non-5xx error", async () => {
    respondWith(429);

    await expect(loadViewer(queryClient)).rejects.toThrow("429");
  });

  it("keeps a 401 as a cached signed-out viewer", async () => {
    respondWith(401);

    expect(await loadViewer(queryClient)).toEqual({});
    expect(queryClient.getQueryState(queryKeys.currentUser())?.status).toBe(
      "success",
    );
  });

  it("returns the viewer when signed in", async () => {
    respondWith(200, { user: { id: "u1" } });

    expect(await loadViewerId(queryClient)).toBe("u1");
  });
});
