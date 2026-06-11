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

const SELF = { alias: "Calm Otter", avatarSeed: "self-seed" };
const PARTNER = { alias: "Blue Fox", avatarSeed: "partner-seed" };

describe("MessageList", () => {
  it("renders the typing indicator only when partnerStatus is 'typing'", () => {
    const { container, rerender } = render(
      <MessageList
        messages={[makeMessage()]}
        partnerStatus="online"
        onReact={() => {}}
        onReply={() => {}}
        self={SELF}
        partner={PARTNER}
      />,
    );
    expect(container.querySelector(".animate-bounce")).toBeNull();

    rerender(
      <MessageList
        messages={[makeMessage()]}
        partnerStatus="typing"
        onReact={() => {}}
        onReply={() => {}}
        self={SELF}
        partner={PARTNER}
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
        onReply={() => {}}
        self={SELF}
        partner={PARTNER}
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
