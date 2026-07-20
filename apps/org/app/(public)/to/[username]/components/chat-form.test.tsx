import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/message", () => ({
  sendMessageAction: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

import { ChatForm } from "./chat-form";

afterEach(cleanup);

describe("ChatForm message character limit", () => {
  it("uses the organization limit for the textarea and counter", async () => {
    const user = userEvent.setup();
    render(<ChatForm orgId="org-1" messageCharLimit={250} />);

    const textarea = screen.getByPlaceholderText(
      "Type your anonymous message…",
    );
    expect(textarea).toHaveAttribute("maxlength", "250");
    expect(screen.getByText("0/250")).toBeInTheDocument();

    await user.type(textarea, "hello");

    expect(screen.getByText("5/250")).toBeInTheDocument();
  });
});
