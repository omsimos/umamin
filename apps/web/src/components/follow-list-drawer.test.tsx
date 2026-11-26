import type { InfiniteData } from "@tanstack/react-query";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/query";
import type {
  CurrentUserResponse,
  FollowListResponse,
  FollowListUser,
  PublicUserWithBadge,
} from "@/lib/types";

const callAction = vi.fn();
vi.mock("@/lib/api", () => ({
  callAction: (name: string, input?: unknown) => callAction(name, input),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/posthog", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useAppNavigate: () => vi.fn(),
}));

import { FollowListDrawer } from "./follow-list-drawer";

const bob = {
  id: "bob-id",
  username: "bob",
  displayName: null,
  imageUrl: null,
  groupBadge: null,
  isFollowing: false,
} as unknown as FollowListUser;

function profile(username: string, counts: Partial<PublicUserWithBadge>) {
  return { id: `${username}-id`, username, ...counts } as PublicUserWithBadge;
}

// Stands in for a mounted profile header: an active observer whose fetch
// returns the Worker's cached profile from before this device's follow.
function ProfileCounts({
  username,
  stale,
}: {
  username: string;
  stale: PublicUserWithBadge;
}) {
  const { data } = useQuery({
    queryKey: queryKeys.userProfile(username),
    queryFn: async () => stale,
    staleTime: Number.POSITIVE_INFINITY,
  });
  return (
    <p data-testid={`counts-${username}`}>
      {data?.followerCount}/{data?.followingCount}
    </p>
  );
}

describe("FollowListDrawer follow row", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    // Desktop renders the list in a Dialog, which jsdom handles.
    window.matchMedia = ((query: string) => ({
      ...originalMatchMedia(query),
      matches: true,
    })) as typeof window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.clearAllMocks();
  });

  it("keeps the follower counts this device patched when the profile read is older", async () => {
    callAction.mockResolvedValue({ success: true });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    client.setQueryData<InfiniteData<FollowListResponse>>(
      queryKeys.followers("alice"),
      {
        pages: [{ data: [bob], nextCursor: null, viewerId: "me-id" }],
        pageParams: [null],
      },
    );
    client.setQueryData<CurrentUserResponse>(queryKeys.currentUser(), {
      user: { id: "me-id", username: "me", followingCount: 3 },
    } as unknown as CurrentUserResponse);
    // Both profiles were already patched on this device, newer than the
    // Worker's cached reads below.
    client.setQueryData(
      queryKeys.userProfile("bob"),
      profile("bob", { followerCount: 10, followingCount: 0 }),
    );
    client.setQueryData(
      queryKeys.userProfile("me"),
      profile("me", { followerCount: 0, followingCount: 3 }),
    );

    render(
      <QueryClientProvider client={client}>
        <ProfileCounts
          username="bob"
          stale={profile("bob", { followerCount: 9, followingCount: 0 })}
        />
        <ProfileCounts
          username="me"
          stale={profile("me", { followerCount: 0, followingCount: 2 })}
        />
        <FollowListDrawer
          username="alice"
          followerCount={1}
          followingCount={0}
        />
      </QueryClientProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: /Follower/ }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Follow" }),
    );

    await waitFor(() =>
      expect(callAction).toHaveBeenCalledWith("followUserAction", {
        userId: "bob-id",
      }),
    );
    await screen.findByRole("button", { name: "Following" });
    await waitFor(() =>
      expect(client.isFetching({ queryKey: ["user-profile"] })).toBe(0),
    );

    expect(screen.getByTestId("counts-bob")).toHaveTextContent("11/0");
    expect(screen.getByTestId("counts-me")).toHaveTextContent("0/4");
  });
});
