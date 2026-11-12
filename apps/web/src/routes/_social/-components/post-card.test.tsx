import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BURST_ACTION_REJECT_MESSAGE } from "@/hooks/use-burst-action";
import { queryKeys } from "@/lib/query";
import type { CommentData } from "@/lib/types";
import type { PostData, PostResponse } from "@/lib/types";
import { PostCard } from "./post-card";

vi.mock("../-lib/actions", () => ({
  addCommentLikeAction: vi.fn(),
  addLikeAction: vi.fn(),
  addRepostAction: vi.fn(),
  removeCommentLikeAction: vi.fn(),
  removeLikeAction: vi.fn(),
  removeRepostAction: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("@/lib/posthog", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/navigation", () => ({
  // oxlint-disable-next-line typescript/no-explicit-any -- test stub
  Link: ({ to, href, children, prefetch: _p, preload: _pl, ...rest }: any) => (
    <a href={to ?? href} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => "/",
  useAppNavigate: () => () => {},
}));
// Severs the heavy compose/menu import chains; none are under test.
vi.mock("@/components/compose-dialog", () => ({ ComposeDialog: () => null }));
vi.mock("./post-menu", () => ({ PostMenu: () => null }));
vi.mock("./comment-menu", () => ({ CommentMenu: () => null }));

import {
  addCommentLikeAction,
  addLikeAction,
  addRepostAction,
  removeLikeAction,
  removeRepostAction,
} from "../-lib/actions";

const addLike = vi.mocked(addLikeAction);
const removeLike = vi.mocked(removeLikeAction);
const addRepost = vi.mocked(addRepostAction);
const removeRepost = vi.mocked(removeRepostAction);
const addCommentLike = vi.mocked(addCommentLikeAction);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const basePost = {
  id: "post-1",
  authorId: "author-1",
  content: "hello",
  likeCount: 5,
  repostCount: 2,
  commentCount: 0,
  isLiked: false,
  isReposted: false,
  quotedPostId: null,
  createdAt: new Date("2026-06-01T00:00:00Z"),
  updatedAt: new Date("2026-06-01T00:00:00Z"),
  author: {
    id: "author-1",
    username: "alice",
    displayName: null,
    imageUrl: null,
  },
} as unknown as PostData;

// Renders the card from the post cache, as the feed and thread do, so a cache
// write reaches the card's props the way it does in the app.
function CachedPostCard() {
  const { data } = useQuery<PostResponse>({
    queryKey: queryKeys.post("post-1"),
    queryFn: () => basePost,
    initialData: basePost,
    staleTime: Number.POSITIVE_INFINITY,
  });
  return data ? (
    <PostCard data={data} isAuthenticated currentUserId="viewer-1" />
  ) : null;
}

function renderCard() {
  const queryClient = new QueryClient();
  const { unmount } = render(
    <QueryClientProvider client={queryClient}>
      <CachedPostCard />
    </QueryClientProvider>,
  );
  const cached = () =>
    queryClient.getQueryData<PostResponse>(queryKeys.post("post-1"));
  return { cached, unmount };
}

const likeButton = () => screen.getByRole("button", { name: /like post/i });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PostCard like toggle", () => {
  it("ends consistent when a double tap's like fails and the unlike was a no-op", async () => {
    const add = deferred<unknown>();
    const remove = deferred<unknown>();
    addLike.mockReturnValue(add.promise as never);
    removeLike.mockReturnValue(remove.promise as never);
    const { cached } = renderCard();

    fireEvent.click(likeButton());
    fireEvent.click(likeButton());

    await act(async () => add.resolve({ error: "Couldn't like." }));
    await act(async () => remove.resolve({ alreadyRemoved: true }));

    expect(likeButton()).toHaveAttribute("aria-pressed", "false");
    expect(likeButton()).toHaveTextContent("5");
    expect(cached()?.isLiked).toBe(false);
    expect(cached()?.likeCount).toBe(5);
  });

  it("does not flip back when the like lands while the unlike is in flight", async () => {
    const add = deferred<unknown>();
    const remove = deferred<unknown>();
    addLike.mockReturnValue(add.promise as never);
    removeLike.mockReturnValue(remove.promise as never);
    const { cached } = renderCard();

    fireEvent.click(likeButton());
    fireEvent.click(likeButton());
    expect(likeButton()).toHaveAttribute("aria-pressed", "false");

    await act(async () => add.resolve({ success: true }));

    expect(likeButton()).toHaveAttribute("aria-pressed", "false");
    expect(likeButton()).toHaveTextContent("5");

    await waitFor(() => expect(removeLike).toHaveBeenCalled());
    await act(async () => remove.resolve({ success: true }));

    expect(likeButton()).toHaveAttribute("aria-pressed", "false");
    expect(likeButton()).toHaveTextContent("5");
    expect(cached()?.isLiked).toBe(false);
    expect(cached()?.likeCount).toBe(5);
  });

  it("rolls back to the server-confirmed state when the second request fails", async () => {
    addLike.mockResolvedValue({ success: true } as never);
    const remove = deferred<unknown>();
    removeLike.mockReturnValue(remove.promise as never);
    const { cached } = renderCard();

    fireEvent.click(likeButton());
    fireEvent.click(likeButton());
    await waitFor(() => expect(removeLike).toHaveBeenCalled());
    await act(async () => remove.resolve({ error: "Couldn't unlike." }));

    // The like went through, so the rollback lands on liked, not on the
    // pre-tap state.
    expect(likeButton()).toHaveAttribute("aria-pressed", "true");
    expect(likeButton()).toHaveTextContent("6");
    expect(cached()?.isLiked).toBe(true);
    expect(cached()?.likeCount).toBe(6);
  });

  it("keeps the post unliked when the card unmounts before a refused like returns", async () => {
    const add = deferred<unknown>();
    addLike.mockReturnValue(add.promise as never);
    const { cached, unmount } = renderCard();

    fireEvent.click(likeButton());
    unmount();
    await act(async () => add.resolve({ error: "Couldn't like." }));

    expect(cached()?.isLiked).toBe(false);
    expect(cached()?.likeCount).toBe(5);
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("PostCard repost toggle", () => {
  it("shows the post as reposted when the server says it already was", async () => {
    addRepost.mockResolvedValue({ alreadyReposted: true } as never);
    const { cached } = renderCard();

    await userEvent.click(
      screen.getByRole("button", { name: "Repost options" }),
    );
    await userEvent.click(await screen.findByText("Repost"));

    await waitFor(() => expect(cached()?.isReposted).toBe(true));
    expect(cached()?.repostCount).toBe(2);
    expect(
      screen.getByRole("button", { name: "Repost options" }),
    ).toHaveTextContent("2");
  });

  it("takes the server's count when it says the post was already reposted", async () => {
    // Reposted on another device: the cache never counted it.
    addRepost.mockResolvedValue({ alreadyReposted: true, count: 3 } as never);
    const { cached } = renderCard();

    await userEvent.click(
      screen.getByRole("button", { name: "Repost options" }),
    );
    await userEvent.click(await screen.findByText("Repost"));

    await waitFor(() => expect(cached()?.isReposted).toBe(true));
    expect(cached()?.repostCount).toBe(3);
    expect(
      screen.getByRole("button", { name: "Repost options" }),
    ).toHaveTextContent("3");
  });
});

const repostedPost = { ...basePost, isReposted: true } as PostData;

function CachedRepostedPostCard() {
  const { data } = useQuery<PostResponse>({
    queryKey: queryKeys.post("post-1"),
    queryFn: () => repostedPost,
    initialData: repostedPost,
    staleTime: Number.POSITIVE_INFINITY,
  });
  return data ? (
    <PostCard data={data} isAuthenticated currentUserId="viewer-1" />
  ) : null;
}

const comment = {
  id: "comment-1",
  postId: "post-1",
  authorId: "author-1",
  content: "nice",
  likeCount: 1,
  isLiked: false,
  createdAt: new Date("2026-06-01T00:00:00Z"),
  updatedAt: new Date("2026-06-01T00:00:00Z"),
  author: {
    id: "author-1",
    username: "alice",
    displayName: null,
    imageUrl: null,
  },
} as unknown as CommentData;

describe("PostCard toasts", () => {
  it("toasts when a like lands", async () => {
    addLike.mockResolvedValue({ success: true } as never);
    const { cached } = renderCard();

    fireEvent.click(likeButton());

    await waitFor(() => expect(cached()?.isLiked).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Post liked.");
  });

  it("toasts when a repost lands and when it is removed", async () => {
    addRepost.mockResolvedValue({ success: true } as never);
    const { cached, unmount } = renderCard();

    await userEvent.click(
      screen.getByRole("button", { name: "Repost options" }),
    );
    await userEvent.click(await screen.findByText("Repost"));

    await waitFor(() => expect(cached()?.isReposted).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Reposted.");
    unmount();

    removeRepost.mockResolvedValue({ alreadyRemoved: true } as never);
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <CachedRepostedPostCard />
      </QueryClientProvider>,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Repost options" }),
    );
    await userEvent.click(await screen.findByText("Remove repost"));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Repost removed."),
    );
    expect(removeRepost).toHaveBeenCalledWith({ postId: "post-1" });
  });

  it("likes a comment with its own action and toast", async () => {
    addCommentLike.mockResolvedValue({ success: true } as never);
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <PostCard
          data={comment}
          isComment
          isAuthenticated
          currentUserId="viewer-1"
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Like comment" }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Comment liked."),
    );
    expect(addCommentLike).toHaveBeenCalledWith({ commentId: comment.id });
    expect(addLike).not.toHaveBeenCalled();
  });
});

describe("PostCard like burst", () => {
  it("refuses the fifth like in a burst", async () => {
    addLike.mockResolvedValue({ success: true } as never);
    removeLike.mockResolvedValue({ success: true } as never);
    const { cached } = renderCard();
    const likeRequests = () =>
      addLike.mock.calls.length + removeLike.mock.calls.length;

    for (let sent = 1; sent <= 4; sent++) {
      fireEvent.click(likeButton());
      const liked = sent % 2 === 1;
      await waitFor(() => expect(cached()?.isLiked).toBe(liked));
      expect(likeRequests()).toBe(sent);
    }

    fireEvent.click(likeButton());

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(BURST_ACTION_REJECT_MESSAGE),
    );
    expect(likeRequests()).toBe(4);
    expect(likeButton()).toHaveAttribute("aria-pressed", "false");
  });
});
