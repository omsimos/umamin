import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "../../lib/session/types";
import { MessageBubble } from "./message-bubble";

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "m1",
    author: "partner",
    text: "hello there",
    ts: 0,
    reactions: [],
    ...overrides,
  };
}

describe("MessageBubble", () => {
  it("toggles the reaction picker when the bubble is clicked", async () => {
    render(<MessageBubble message={makeMessage()} onReact={() => {}} />);

    expect(screen.queryByRole("button", { name: /^React / })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "hello there" }));
    expect(
      screen.getAllByRole("button", { name: /^React / }).length,
    ).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: "hello there" }));
    expect(screen.queryByRole("button", { name: /^React / })).toBeNull();
  });

  it("calls onReact and closes the picker when an emoji is chosen", async () => {
    const onReact = vi.fn();
    render(<MessageBubble message={makeMessage()} onReact={onReact} />);

    await userEvent.click(screen.getByRole("button", { name: "hello there" }));
    const emojiButton = screen.getAllByRole("button", { name: /^React / })[0];
    await userEvent.click(emojiButton);

    expect(onReact).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /^React / })).toBeNull();
  });

  it("renders reactions only when the message has them", () => {
    const { rerender } = render(
      <MessageBubble message={makeMessage()} onReact={() => {}} />,
    );
    expect(screen.queryByText("🔥")).toBeNull();

    rerender(
      <MessageBubble
        message={makeMessage({ reactions: ["🔥"] })}
        onReact={() => {}}
      />,
    );
    expect(screen.getByText("🔥")).toBeInTheDocument();
  });
});
