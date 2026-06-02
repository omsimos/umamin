import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../../lib/session/types";
import { MessageList } from "./message-list";

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

describe("MessageList", () => {
  it("renders the typing indicator only when partnerStatus is 'typing'", () => {
    const { container, rerender } = render(
      <MessageList
        messages={[makeMessage()]}
        partnerStatus="online"
        onReact={() => {}}
      />,
    );
    expect(container.querySelector(".animate-bounce")).toBeNull();

    rerender(
      <MessageList
        messages={[makeMessage()]}
        partnerStatus="typing"
        onReact={() => {}}
      />,
    );
    expect(container.querySelector(".animate-bounce")).not.toBeNull();
  });

  it("renders the header slot above the messages", () => {
    render(
      <MessageList
        messages={[makeMessage({ text: "first message" })]}
        partnerStatus="online"
        onReact={() => {}}
        header={<div>ice breaker</div>}
      />,
    );

    const header = screen.getByText("ice breaker");
    const message = screen.getByText("first message");
    expect(header).toBeInTheDocument();
    expect(
      header.compareDocumentPosition(message) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
