import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/query";
import {
  fetchCurrentUserOptional,
  fetchUserProfile,
  fetchUserProfileViewer,
} from "@/lib/query-fetchers";
import type { CurrentUserResponse, PublicUserWithBadge } from "@/lib/types";
import { UserProfile } from "./user-profile";

const navigate = vi.fn();
const flags = { dm: false };

// next/navigation → the nav shim; UserProfile uses useAppNavigate.
vi.mock("@/lib/navigation", () => ({
  useAppNavigate: () => navigate,
}));

vi.mock("@/hooks/use-feature-flags", () => ({
  useFeatureFlags: () => flags,
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Follow/block actions moved to the route group's colocated wrappers.
vi.mock("../-lib/actions", () => ({
  blockUserAction: vi.fn(),
  followUserAction: vi.fn(),
  unblockUserAction: vi.fn(),
  unfollowUserAction: vi.fn(),
}));

vi.mock("@/components/share-button", () => ({
  shareProfile: vi.fn(),
}));

// Stub the moderator dialog so the test doesn't pull in its server-action graph.
vi.mock("@/components/ban-user-dialog", () => ({
  BanUserDialog: () => null,
}));

vi.mock("@/components/user-card", () => ({
  UserCard: ({
    headerActions,
    primaryAction,
  }: {
    headerActions?: React.ReactNode;
    primaryAction?: React.ReactNode;
  }) => (
    <div>
      {headerActions}
      {primaryAction}
    </div>
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
  proUntil: null,
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
};

function renderProfile(seed?: (queryClient: QueryClient) => void) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  seed?.(queryClient);

  return render(
    <QueryClientProvider client={queryClient}>
      <UserProfile username="alice" initialUser={profile} />
    </QueryClientProvider>,
  );
}

describe("UserProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flags.dm = false;
    vi.mocked(fetchUserProfile).mockResolvedValue(profile);
    vi.mocked(fetchCurrentUserOptional).mockResolvedValue({
      user: {
        ...profile,
        id: "viewer-1",
        username: "viewer",
        hasPassword: true,
        blockedWords: null,
        pushPrefs: 0,
        hideDrama: true,
        messageFilter: false,
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
      isMuted: false,
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

  describe("chat button", () => {
    // Seeded rather than fetched so the first render already has the viewer
    // state; otherwise "hidden" passes on the pre-load render.
    async function renderWithViewer(over: {
      isFollowing?: boolean;
      isBlocked?: boolean;
    }) {
      const viewer = {
        currentUserId: "viewer-1",
        isAuthenticated: true,
        isFollowing: true,
        isBlocked: false,
        isBlockedBy: false,
        isMuted: false,
        isBanned: false,
        ...over,
      };
      vi.mocked(fetchUserProfileViewer).mockResolvedValue(viewer);
      const currentUser = await fetchCurrentUserOptional();
      renderProfile((queryClient) => {
        queryClient.setQueryData(queryKeys.currentUser(), currentUser);
        queryClient.setQueryData(queryKeys.userProfileViewer("alice"), viewer);
      });
    }

    it("opens the chat when DMs are on and the viewer follows them", async () => {
      flags.dm = true;
      await renderWithViewer({});

      const button = await screen.findByRole("button", {
        name: "Chat with @alice",
      });
      await userEvent.click(button);
      expect(navigate).toHaveBeenCalledWith("/inbox/chats/alice");
    });

    it.each([
      ["DMs are off", false, {}],
      ["the viewer doesn't follow them", true, { isFollowing: false }],
      ["the viewer blocked them", true, { isBlocked: true }],
    ])("is hidden when %s", async (_case, dm, over) => {
      flags.dm = dm;
      await renderWithViewer(over);

      expect(
        screen.queryByRole("button", { name: "Chat with @alice" }),
      ).toBeNull();
    });
  });
});
