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
  createComment: vi.fn(),
  fetchComments: vi.fn(),
}));

vi.mock("../-lib/actions", () => ({
  deleteCommentAction: mocks.deleteComment,
  createCommentAction: mocks.createComment,
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

import type { PublicUser } from "@/lib/types";
import { CommentsList } from "./comments-list";
import ReplyForm from "./reply-form";

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

// A page load with a fresh query cache. `hydrated` primes it with the server's
// page, as SSR hydration leaves it; otherwise the list fetches that page.
function loadPage({
  page = serverPage,
  hydrated = true,
}: { page?: CommentsResponse; hydrated?: boolean } = {}) {
  mocks.fetchComments.mockResolvedValue(page);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(queryKeys.currentUser(), {
    user: { id: "viewer-1", isModerator: false },
  });
  if (hydrated) {
    queryClient.setQueryData<InfiniteData<CommentsResponse>>(
      queryKeys.postComments("post-1"),
      { pages: [page], pageParams: [null] },
    );
  }
  render(
    <QueryClientProvider client={queryClient}>
      <CommentsList postId="post-1" isAuthenticated currentUserId="viewer-1" />
      <ReplyForm
        user={{ id: "viewer-1", username: "viewer" } as unknown as PublicUser}
        postId="post-1"
      />
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

describe("CommentsList created comments", () => {
  const created = {
    id: "c-new",
    postId: "post-1",
    authorId: "viewer-1",
    content: "fresh reply",
    createdAt: "2026-11-27T00:00:00.000Z",
    updatedAt: "2026-11-27T00:00:00.000Z",
    likeCount: 0,
  };

  beforeEach(() => {
    sessionStorage.clear();
    mocks.deleteComment.mockResolvedValue({ success: true });
    mocks.createComment.mockResolvedValue({ comment: created });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function postReply() {
    const user = userEvent.setup();
    await user.type(
      screen.getByPlaceholderText("Leave a reply..."),
      "fresh reply",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(mocks.createComment).toHaveBeenCalledTimes(1));
    await screen.findByText("fresh reply");
  }

  // Comment bodies in the order the list renders them.
  function commentTexts() {
    return screen
      .getAllByText(/^(fresh reply|delete me|keep me)$/)
      .map((el) => el.textContent);
  }

  it.each([
    ["hydrated", true],
    ["fetched", false],
  ])(
    "keeps a just-created comment at the top after a reload (%s page)",
    async (_label, hydrated) => {
      loadPage();
      await postReply();

      cleanup();
      loadPage({ hydrated });

      await screen.findByText("fresh reply");
      expect(commentTexts()).toEqual(["fresh reply", "delete me", "keep me"]);
    },
  );

  it("keeps a created then deleted comment gone after a reload", async () => {
    loadPage();
    await postReply();
    const user = userEvent.setup();
    await user.click(
      screen.getAllByRole("button", { name: "More options" })[0],
    );
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    await user.click(await screen.findByRole("button", { name: "Continue" }));
    await waitFor(() =>
      expect(screen.queryByText("fresh reply")).not.toBeInTheDocument(),
    );

    cleanup();
    loadPage();

    await screen.findByText("keep me");
    expect(screen.queryByText("fresh reply")).not.toBeInTheDocument();
  });

  it("stops adding the comment once the server returns it", async () => {
    loadPage();
    await postReply();

    cleanup();
    loadPage({
      hydrated: false,
      page: { ...serverPage, data: [created as never, ...serverPage.data] },
    });
    await screen.findByText("fresh reply");

    // A later read without it means it is really gone, for example removed
    // by a moderator.
    cleanup();
    loadPage({ hydrated: false });
    await screen.findByText("keep me");
    expect(screen.queryByText("fresh reply")).not.toBeInTheDocument();
  });
});
