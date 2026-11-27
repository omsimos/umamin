import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReplyDialog } from "./reply-dialog";

const { createReplyAction, toastError } = vi.hoisted(() => ({
  createReplyAction: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock("./actions", () => ({ createReplyAction }));
vi.mock("sonner", () => ({
  toast: { error: toastError, success: vi.fn() },
}));

function renderDialog() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ReplyDialog
        open
        onOpenChange={() => {}}
        data={{ id: "m1", question: "q", content: "hello", reply: null }}
      />
    </QueryClientProvider>,
  );
}

describe("ReplyDialog", () => {
  beforeEach(() => {
    createReplyAction.mockReset();
    toastError.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("shows the server's reason when a reply is rejected", async () => {
    const reason = "You're replying too fast. Try again in a minute.";
    createReplyAction.mockResolvedValue({ error: reason });
    renderDialog();

    fireEvent.change(screen.getByPlaceholderText("Type your reply..."), {
      target: { value: "thanks" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(reason));
  });

  it("falls back to a generic message for an unexpected failure", async () => {
    createReplyAction.mockRejectedValue(new TypeError("boom"));
    renderDialog();

    fireEvent.change(screen.getByPlaceholderText("Type your reply..."), {
      target: { value: "thanks" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(toastError).not.toHaveBeenCalledWith("boom");
  });
});
