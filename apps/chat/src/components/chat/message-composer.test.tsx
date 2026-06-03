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
    expect(onSend).toHaveBeenCalledWith("hi there");
    expect(screen.getByRole("textbox")).toHaveValue("");
  });
});
