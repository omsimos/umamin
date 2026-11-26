import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicUser } from "@/lib/types";

const mocks = vi.hoisted(() => ({ createComment: vi.fn() }));

vi.mock("../-lib/actions", () => ({
  createCommentAction: mocks.createComment,
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("@/lib/posthog", () => ({ captureException: vi.fn() }));

import ReplyForm from "./reply-form";

const user = {
  id: "viewer-1",
  username: "viewer",
  displayName: null,
  imageUrl: null,
} as unknown as PublicUser;

function renderForm() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ReplyForm user={user} postId="post-1" />
    </QueryClientProvider>,
  );
}

describe("ReplyForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gives the draft back when the comment fails", async () => {
    mocks.createComment.mockResolvedValue({ error: "Slow down." });
    renderForm();
    const box = screen.getByPlaceholderText("Leave a reply...");

    await userEvent.type(box, "my reply");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(box).toHaveValue("my reply");
  });

  it("clears the box once the comment is posted", async () => {
    mocks.createComment.mockResolvedValue({
      comment: { id: "c-1", postId: "post-1", content: "my reply" },
    });
    renderForm();
    const box = screen.getByPlaceholderText("Leave a reply...");

    await userEvent.type(box, "my reply");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(box).toHaveValue("");
  });
});
