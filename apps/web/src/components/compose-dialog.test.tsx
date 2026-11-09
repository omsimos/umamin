import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  submit: vi.fn<(vars: unknown) => Promise<unknown>>(),
}));

// Stands in for the real mutation: pending from submit until it settles.
vi.mock("@/hooks/use-create-post", async () => {
  const { useState } = await import("react");
  return {
    useCreatePost: () => {
      const [isPending, setPending] = useState(false);
      return {
        isPending,
        submitPost: (vars: unknown) => {
          setPending(true);
          return mocks.submit(vars).finally(() => setPending(false));
        },
      };
    },
  };
});
vi.mock("@/lib/query-fetchers", () => ({
  fetchCurrentUserOptional: vi.fn(async () => ({})),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { info: vi.fn(), error: vi.fn() }),
}));

import { queryKeys } from "@/lib/query";
import { ComposeDialog } from "./compose-dialog";

function renderComposer() {
  const queryClient = new QueryClient();
  queryClient.setQueryData(queryKeys.currentUser(), {
    user: { id: "alice", username: "alice", createdAt: new Date() },
  });
  const onOpenChange = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <ComposeDialog open onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

describe("ComposeDialog while a post is sending", () => {
  beforeEach(() => {
    mocks.submit.mockReset();
  });

  it("can't be closed or discarded until the post settles", async () => {
    let fail: (err: Error) => void = () => {};
    mocks.submit.mockReturnValue(
      new Promise((_, reject) => {
        fail = reject;
      }),
    );
    const user = userEvent.setup();
    const { onOpenChange } = renderComposer();

    await user.type(screen.getByRole("textbox"), "hello");
    await user.click(screen.getByRole("button", { name: "Post" }));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Discard this post?")).toBeNull();

    await user.keyboard("{Escape}");
    expect(screen.queryByText("Discard this post?")).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalled();

    // The post fails: the draft is still there to retry.
    fail(new Error("Couldn't post."));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled(),
    );
    expect(screen.getByRole("textbox")).toHaveValue("hello");
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
