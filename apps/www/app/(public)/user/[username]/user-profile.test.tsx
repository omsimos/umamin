import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchCurrentUserOptional,
  fetchUserProfile,
  fetchUserProfileViewer,
} from "@/lib/query-fetchers";
import type { CurrentUserResponse } from "@/lib/query-types";
import type { PublicUserWithBadge } from "@/types/user";
import { UserProfile } from "./user-profile";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/app/actions/user", () => ({
  blockUserAction: vi.fn(),
  followUserAction: vi.fn(),
  unblockUserAction: vi.fn(),
  unfollowUserAction: vi.fn(),
}));

vi.mock("@/components/share-button", () => ({
  shareProfile: vi.fn(),
}));

// Stub the moderator dialog so the test doesn't pull in its server-action graph
// (@umamin/db builds a client on import).
vi.mock("@/components/ban-user-dialog", () => ({
  BanUserDialog: () => null,
}));

vi.mock("@/components/user-card", () => ({
  UserCard: ({ primaryAction }: { primaryAction?: React.ReactNode }) => (
    <div>{primaryAction}</div>
  ),
}));

vi.mock("@/components/you-tabs", () => ({
  YouTabs: () => null,
}));

vi.mock("./profile-post-list", () => ({
  ProfilePostList: () => null,
}));

vi.mock("@/lib/query-fetchers", () => ({
  fetchCurrentUserOptional: vi.fn(),
  fetchUserProfile: vi.fn(),
  fetchUserProfileViewer: vi.fn(),
}));

const profile: PublicUserWithBadge = {
  id: "target-1",
  username: "alice",
  displayName: null,
  imageUrl: null,
  bannerImageUrl: null,
  bio: null,
  question: "Ask me anything",
  quietMode: false,
  pinnedPostId: null,
  equippedGroupId: null,
  followerCount: 2,
  followingCount: 3,
  points: 0,
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
};

function renderProfile() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <UserProfile username="alice" initialUser={profile} />
    </QueryClientProvider>,
  );
}

describe("UserProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchUserProfile).mockResolvedValue(profile);
    vi.mocked(fetchCurrentUserOptional).mockResolvedValue({
      user: {
        ...profile,
        id: "viewer-1",
        username: "viewer",
        hasPassword: true,
        blockedWords: null,
        pushPrefs: 0,
        accounts: [],
        isModerator: false,
      },
    } satisfies CurrentUserResponse);
  });

  it("loads the viewer follow state on profile page load", async () => {
    vi.mocked(fetchUserProfileViewer).mockResolvedValue({
      currentUserId: "viewer-1",
      isAuthenticated: true,
      isFollowing: true,
      isBlocked: false,
      isBlockedBy: false,
      isBanned: false,
    });

    renderProfile();

    await waitFor(() => {
      expect(fetchUserProfileViewer).toHaveBeenCalledWith("alice");
    });

    expect(
      await screen.findByRole("button", { name: "Following" }),
    ).toBeInTheDocument();
  });
});
