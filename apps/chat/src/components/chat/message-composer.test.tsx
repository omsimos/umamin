import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MessageComposer } from "./message-composer";

describe("MessageComposer", () => {
  it("disables send when the input is empty or whitespace", async () => {
    render(<MessageComposer onSend={() => {}} />);
    const send = screen.getByRole("button", { name: /send/i });
    expect(send).toBeDisabled();
    await userEvent.type(screen.getByRole("textbox"), "   ");
    expect(send).toBeDisabled();
  });

  it("sends trimmed text and clears the field", async () => {
    const onSend = vi.fn();
    render(<MessageComposer onSend={onSend} />);
    await userEvent.type(screen.getByRole("textbox"), "  hi there  ");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(onSend).toHaveBeenCalledWith("hi there", { whisper: false });
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("sends with whisper mode and resets the mode after sending", async () => {
    const onSend = vi.fn();
    render(<MessageComposer onSend={onSend} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Message options" }),
    );
    await userEvent.click(screen.getByRole("button", { name: /Whisper/ }));
    expect(screen.getByText(/disappears ~10s after/)).toBeInTheDocument();

    await userEvent.type(screen.getByRole("textbox"), "secret");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(onSend).toHaveBeenCalledWith("secret", { whisper: true });
    // Mode resets — the chip is gone.
    expect(screen.queryByText(/disappears ~10s after/)).toBeNull();
  });

  it("whisper and effect modes are mutually exclusive", async () => {
    const onSend = vi.fn();
    render(<MessageComposer onSend={onSend} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Message options" }),
    );
    await userEvent.click(screen.getByRole("button", { name: /Whisper/ }));
    await userEvent.click(
      screen.getByRole("button", { name: "Message options" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Send with confetti/ }),
    );
    await userEvent.type(screen.getByRole("textbox"), "yay");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(onSend).toHaveBeenCalledWith("yay", {
      whisper: false,
      effect: "confetti",
    });
  });

  it("clears the active mode via the chip's clear button", async () => {
    render(<MessageComposer onSend={() => {}} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Message options" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Send with hearts/ }),
    );
    expect(screen.getByText(/Sends with hearts/)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Clear message option" }),
    );
    expect(screen.queryByText(/Sends with hearts/)).toBeNull();
  });

  it("shows the reply banner and cancels it via the close button", async () => {
    const onCancelReply = vi.fn();
    render(
      <MessageComposer
        onSend={() => {}}
        replyTo={{ authorLabel: "Blue Fox", text: "the original" }}
        onCancelReply={onCancelReply}
      />,
    );
    expect(screen.getByText("Replying to Blue Fox")).toBeInTheDocument();
    expect(screen.getByText("the original")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel reply" }));
    expect(onCancelReply).toHaveBeenCalledTimes(1);
  });

  it("focuses the input when a reply starts and cancels on Escape", async () => {
    const onCancelReply = vi.fn();
    const { rerender } = render(
      <MessageComposer onSend={() => {}} onCancelReply={onCancelReply} />,
    );
    expect(screen.queryByText(/Replying to/)).toBeNull();

    rerender(
      <MessageComposer
        onSend={() => {}}
        replyTo={{ authorLabel: "yourself", text: "earlier" }}
        onCancelReply={onCancelReply}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(onCancelReply).toHaveBeenCalledTimes(1);
  });
});
