import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/query";

const mocks = vi.hoisted(() => ({
  canGoBack: false,
  back: vi.fn(),
  navigate: vi.fn(),
  deletePost: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useCanGoBack: () => mocks.canGoBack,
  useRouter: () => ({ history: { back: mocks.back } }),
}));
vi.mock("@/lib/navigation", () => ({
  useAppNavigate: () => mocks.navigate,
}));
vi.mock("../-lib/actions", () => ({
  deletePostAction: mocks.deletePost,
  pinPostAction: vi.fn(),
  unpinPostAction: vi.fn(),
}));
vi.mock("@/lib/actions", () => ({
  blockUserAction: vi.fn(),
  muteUserAction: vi.fn(),
  unmuteUserAction: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("@/lib/posthog", () => ({ captureException: vi.fn() }));

import { PostHeader } from "./post-header";

function renderOwnPostHeader() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(queryKeys.currentUser(), {
    user: { id: "viewer-1", pinnedPostId: null, isModerator: false },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <PostHeader
        postId="post-1"
        authorId="viewer-1"
        imageId="post-image"
        isAuthenticated
        currentUserId="viewer-1"
      />
    </QueryClientProvider>,
  );
}

async function deleteFromMenu() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "More options" }));
  await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
  await user.click(await screen.findByRole("button", { name: "Continue" }));
}

describe("PostHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deletePost.mockResolvedValue({ success: true });
  });

  it("leaves the page after the post is deleted", async () => {
    mocks.canGoBack = true;
    renderOwnPostHeader();

    await deleteFromMenu();

    await waitFor(() => expect(mocks.back).toHaveBeenCalledTimes(1));
    expect(mocks.deletePost).toHaveBeenCalledWith({ postId: "post-1" });
  });

  it("replaces the dead post with the feed on a cold open", async () => {
    mocks.canGoBack = false;
    renderOwnPostHeader();

    await deleteFromMenu();

    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith("/feed", { replace: true }),
    );
    expect(mocks.back).not.toHaveBeenCalled();
  });

  it("stays on the page when the delete fails", async () => {
    mocks.canGoBack = true;
    mocks.deletePost.mockResolvedValue({ error: "Post not found" });
    renderOwnPostHeader();

    await deleteFromMenu();

    await waitFor(() => expect(mocks.deletePost).toHaveBeenCalled());
    expect(mocks.back).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
