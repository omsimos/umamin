import { render, screen } from "@testing-library/react";
import { ChatComposerSend } from "@umamin/ui/components/chat";
import { describe, expect, it } from "vitest";

describe("ChatComposerSend", () => {
  it("keeps its own data-slot", () => {
    render(<ChatComposerSend />);
    expect(screen.getByRole("button", { name: "Send" })).toHaveAttribute(
      "data-slot",
      "chat-composer-send",
    );
  });

  it("is disabled while a send is pending", () => {
    render(<ChatComposerSend pending />);
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });
});
