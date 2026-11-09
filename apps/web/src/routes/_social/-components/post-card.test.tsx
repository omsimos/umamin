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
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/query";
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
  // biome-ignore lint/suspicious/noExplicitAny: test stub
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
  addLikeAction,
  addRepostAction,
  removeLikeAction,
} from "../-lib/actions";

const addLike = vi.mocked(addLikeAction);
const removeLike = vi.mocked(removeLikeAction);
const addRepost = vi.mocked(addRepostAction);

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
  render(
    <QueryClientProvider client={queryClient}>
      <CachedPostCard />
    </QueryClientProvider>,
  );
  const cached = () =>
    queryClient.getQueryData<PostResponse>(queryKeys.post("post-1"));
  return { cached };
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
