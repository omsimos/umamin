import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BURST_ACTION_REJECT_MESSAGE } from "@/hooks/use-burst-action";
import { vibrate } from "@/lib/haptics";
import { captureException } from "@/lib/posthog";
import { queryKeys } from "@/lib/query";
import type { PostData, PostResponse } from "@/lib/types";
import { PostCardMain } from "./post-card-main";

vi.mock("../-lib/actions", () => ({
  addLikeAction: vi.fn(),
  addRepostAction: vi.fn(),
  removeLikeAction: vi.fn(),
  removeRepostAction: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("@/lib/posthog", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/haptics", () => ({ vibrate: vi.fn() }));
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
// Severs the heavy compose import chain; it is not under test.
vi.mock("@/components/compose-dialog", () => ({ ComposeDialog: () => null }));

import {
  addLikeAction,
  addRepostAction,
  removeLikeAction,
} from "../-lib/actions";

const addLike = vi.mocked(addLikeAction);
const removeLike = vi.mocked(removeLikeAction);
const addRepost = vi.mocked(addRepostAction);

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

// Renders the card from the post cache, as the post page does, so a cache
// write reaches the card's props the way it does in the app.
function CachedPostCardMain() {
  const { data } = useQuery<PostResponse>({
    queryKey: queryKeys.post("post-1"),
    queryFn: () => basePost,
    initialData: basePost,
    staleTime: Number.POSITIVE_INFINITY,
  });
  return data ? (
    <PostCardMain
      data={data}
      imageId="umamin-post-1"
      isAuthenticated
      currentUserId="viewer-1"
    />
  ) : null;
}

function renderCard() {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <CachedPostCardMain />
    </QueryClientProvider>,
  );
  const cached = () =>
    queryClient.getQueryData<PostResponse>(queryKeys.post("post-1"));
  return { cached };
}

const likeButton = () => screen.getByRole("button", { name: /like post/i });
const likeRequests = () =>
  addLike.mock.calls.length + removeLike.mock.calls.length;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PostCardMain like toggle", () => {
  it("likes, toasts and writes the cache", async () => {
    addLike.mockResolvedValue({ success: true } as never);
    const { cached } = renderCard();

    fireEvent.click(likeButton());

    await waitFor(() => expect(cached()?.isLiked).toBe(true));
    expect(likeButton()).toHaveAttribute("aria-pressed", "true");
    expect(cached()?.likeCount).toBe(6);
    expect(toast.success).toHaveBeenCalledWith("Post liked.");
    expect(vibrate).toHaveBeenCalledWith(5);
  });

  it("rolls back, toasts and reports a failed like", async () => {
    addLike.mockResolvedValue({ error: "Couldn't like." } as never);
    renderCard();

    fireEvent.click(likeButton());

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Couldn't like."),
    );
    expect(likeButton()).toHaveAttribute("aria-pressed", "false");
    expect(captureException).toHaveBeenCalledWith(expect.any(Error), {
      source: "like",
    });
  });

  it("takes the server's count when the post was already liked", async () => {
    addLike.mockResolvedValue({ alreadyLiked: true, count: 9 } as never);
    const { cached } = renderCard();

    fireEvent.click(likeButton());

    await waitFor(() => expect(cached()?.likeCount).toBe(9));
    expect(cached()?.isLiked).toBe(true);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("allows six likes in a burst and refuses the seventh", async () => {
    addLike.mockResolvedValue({ success: true } as never);
    removeLike.mockResolvedValue({ success: true } as never);
    const { cached } = renderCard();

    for (let sent = 1; sent <= 6; sent++) {
      fireEvent.click(likeButton());
      const liked = sent % 2 === 1;
      await waitFor(() => expect(cached()?.isLiked).toBe(liked));
      expect(likeRequests()).toBe(sent);
    }

    fireEvent.click(likeButton());

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(BURST_ACTION_REJECT_MESSAGE),
    );
    expect(likeRequests()).toBe(6);
    expect(likeButton()).toHaveAttribute("aria-pressed", "false");
  });
});

describe("PostCardMain repost toggle", () => {
  it("says the post was already reposted", async () => {
    addRepost.mockResolvedValue({ alreadyReposted: true, count: 3 } as never);
    const { cached } = renderCard();

    await userEvent.click(
      screen.getByRole("button", { name: "Repost options" }),
    );
    await userEvent.click(await screen.findByText("Repost"));

    await waitFor(() => expect(cached()?.isReposted).toBe(true));
    expect(cached()?.repostCount).toBe(3);
    expect(toast.error).toHaveBeenCalledWith("Already reposted.");
  });
});
