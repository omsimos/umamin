import type { InfiniteData } from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/query";
import type { CommentData, CommentsResponse } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  deleteComment: vi.fn(),
  fetchComments: vi.fn(),
}));

vi.mock("../-lib/actions", () => ({
  deleteCommentAction: mocks.deleteComment,
  addCommentLikeAction: vi.fn(),
  removeCommentLikeAction: vi.fn(),
  addLikeAction: vi.fn(),
  removeLikeAction: vi.fn(),
  addRepostAction: vi.fn(),
  removeRepostAction: vi.fn(),
}));
vi.mock("@/lib/query-fetchers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/query-fetchers")>()),
  fetchPostCommentsPage: mocks.fetchComments,
}));
vi.mock("@/lib/navigation", () => ({
  Link: ({ children, href }: { children?: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useAppNavigate: () => vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/posthog", () => ({ captureException: vi.fn() }));

import { CommentsList } from "./comments-list";

function comment(id: string, content: string): CommentData {
  return {
    id,
    postId: "post-1",
    authorId: "viewer-1",
    content,
    createdAt: new Date("2026-11-20T00:00:00Z"),
    updatedAt: new Date("2026-11-20T00:00:00Z"),
    likeCount: 0,
    author: { id: "viewer-1", username: "viewer" },
  } as unknown as CommentData;
}

// What the Worker's cached comments read keeps serving for two minutes after
// the delete.
const serverPage: CommentsResponse = {
  data: [comment("c-1", "delete me"), comment("c-2", "keep me")],
  nextCursor: null,
};

// A page load: a fresh query cache primed with the server's page, as SSR
// hydration leaves it.
function loadPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(queryKeys.currentUser(), {
    user: { id: "viewer-1", isModerator: false },
  });
  queryClient.setQueryData<InfiniteData<CommentsResponse>>(
    queryKeys.postComments("post-1"),
    { pages: [serverPage], pageParams: [null] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <CommentsList postId="post-1" isAuthenticated currentUserId="viewer-1" />
    </QueryClientProvider>,
  );
}

describe("CommentsList deleted comments", () => {
  beforeEach(() => {
    sessionStorage.clear();
    mocks.deleteComment.mockResolvedValue({ success: true });
    mocks.fetchComments.mockResolvedValue(serverPage);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("keeps a comment this browser deleted hidden after a reload", async () => {
    loadPage();
    const user = userEvent.setup();
    await user.click(
      screen.getAllByRole("button", { name: "More options" })[0],
    );
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    await user.click(await screen.findByRole("button", { name: "Continue" }));
    await waitFor(() =>
      expect(screen.queryByText("delete me")).not.toBeInTheDocument(),
    );

    cleanup();
    loadPage();

    await screen.findByText("keep me");
    await waitFor(() =>
      expect(screen.queryByText("delete me")).not.toBeInTheDocument(),
    );
  });

  it("shows the comment again once the Worker cache has expired", async () => {
    loadPage();
    const user = userEvent.setup();
    await user.click(
      screen.getAllByRole("button", { name: "More options" })[0],
    );
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    await user.click(await screen.findByRole("button", { name: "Continue" }));
    await waitFor(() =>
      expect(screen.queryByText("delete me")).not.toBeInTheDocument(),
    );

    cleanup();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 10 * 60_000);
    loadPage();

    expect(await screen.findByText("delete me")).toBeInTheDocument();
  });
});
