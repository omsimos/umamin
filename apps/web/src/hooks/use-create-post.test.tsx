import {
  type InfiniteData,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { createPostAction } from "@/lib/actions";
import { patchPostEverywhere } from "@/lib/query-cache";
import type { FeedResponse, PostData, PublicUser } from "@/lib/types";
import { useCreatePost } from "./use-create-post";

vi.mock("@/lib/actions", () => ({ createPostAction: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const user = { id: "u1", username: "me" } as unknown as PublicUser;
const feedKey = ["posts", "latest", "public"];

describe("useCreatePost", () => {
  it("keeps a like made while a failed post was sending", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData<InfiniteData<FeedResponse>>(feedKey, {
      pageParams: [null],
      pages: [
        {
          data: [
            {
              type: "post",
              post: {
                id: "a",
                isLiked: false,
                likeCount: 0,
              } as unknown as PostData,
            },
          ],
          nextCursor: null,
        },
      ] as FeedResponse[],
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const create = deferred<unknown>();
    vi.mocked(createPostAction).mockReturnValue(create.promise as never);
    const { result } = renderHook(() => useCreatePost(user), { wrapper });

    const feedIds = () =>
      queryClient
        .getQueryData<InfiniteData<FeedResponse>>(feedKey)
        ?.pages.flatMap((page) => page.data.map((item) => item.post.id)) ?? [];
    const postA = () =>
      queryClient
        .getQueryData<InfiniteData<FeedResponse>>(feedKey)
        ?.pages.flatMap((page) => page.data)
        .find((item) => item.post.id === "a")?.post;

    act(() => {
      result.current.submitPost({ content: "hi" }).catch(() => {});
    });
    await waitFor(() => expect(feedIds()[0]).toMatch(/^optimistic-/));

    patchPostEverywhere(queryClient, "a", (post) => ({
      ...post,
      isLiked: true,
      likeCount: 1,
    }));

    await act(async () => create.resolve({ error: "Nope" }));
    await waitFor(() =>
      expect(feedIds().some((id) => id.startsWith("optimistic-"))).toBe(false),
    );

    expect(postA()?.isLiked).toBe(true);
    expect(postA()?.likeCount).toBe(1);
  });

  it("leaves a following feed it never touched alone when a post fails", async () => {
    const queryClient = new QueryClient();
    const followingKey = ["posts", "following", "u1"];
    await queryClient.prefetchQuery({
      queryKey: followingKey,
      queryFn: () => Promise.reject(new Error("offline")),
      retry: false,
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    vi.mocked(createPostAction).mockResolvedValue({ error: "Nope" } as never);
    const { result } = renderHook(() => useCreatePost(user), { wrapper });

    await act(async () => {
      await result.current.submitPost({ content: "hi" }).catch(() => {});
    });

    expect(queryClient.getQueryState(followingKey)?.status).toBe("error");
  });
});
