import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/query";

const mocks = vi.hoisted(() => ({
  canGoBack: false,
  back: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useCanGoBack: () => mocks.canGoBack,
  useRouter: () => ({ history: { back: mocks.back } }),
}));
vi.mock("@/lib/navigation", () => ({
  Link: () => null,
  useAppNavigate: () => mocks.navigate,
}));
vi.mock("@/lib/actions", () => ({
  blockUserAction: vi.fn(),
  hideDmThreadAction: vi.fn(),
}));

import { blockUserAction } from "@/lib/actions";
import { blockDmPeer } from "./conversation";

const invalidatedKeys = [
  queryKeys.blockedUsers(),
  queryKeys.dmPeer("pal"),
  queryKeys.receivedMessages(),
  queryKeys.currentUser(),
];

function seededClient() {
  const queryClient = new QueryClient();
  for (const key of [...invalidatedKeys, queryKeys.userProfileViewer("pal")]) {
    queryClient.setQueryData(key, {});
  }
  return queryClient;
}

describe("blockDmPeer", () => {
  beforeEach(() => {
    vi.mocked(blockUserAction).mockReset();
  });

  it("invalidates the caches a block changes", async () => {
    const queryClient = seededClient();
    vi.mocked(blockUserAction).mockResolvedValue({ success: true } as never);

    const res = await blockDmPeer(queryClient, { id: "u2", username: "pal" });

    expect(res).toEqual({ ok: true });
    for (const key of invalidatedKeys) {
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    }
    expect(
      queryClient.getQueryData(queryKeys.userProfileViewer("pal")),
    ).toBeUndefined();
  });

  it("changes nothing when the block fails", async () => {
    const queryClient = seededClient();
    vi.mocked(blockUserAction).mockResolvedValue({
      error: "Rate limited",
    } as never);

    const res = await blockDmPeer(queryClient, { id: "u2", username: "pal" });

    expect(res).toEqual({ ok: false, error: "Rate limited" });
    expect(
      queryClient.getQueryState(queryKeys.blockedUsers())?.isInvalidated,
    ).toBe(false);
    expect(
      queryClient.getQueryData(queryKeys.userProfileViewer("pal")),
    ).toBeDefined();
  });
});
