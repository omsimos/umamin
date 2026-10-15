import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/lib/chat/types";
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

  it("shows the partner's avatar once per run, on its last bubble", () => {
    const run = [
      makeMessage({ id: "p1", text: "one" }),
      makeMessage({ id: "p2", text: "two" }),
      makeMessage({ id: "s1", author: "self", text: "mine" }),
      makeMessage({ id: "p3", text: "three" }),
    ];
    const avatarRows = () =>
      screen
        .getAllByRole("img", { name: PARTNER.alias })
        .map((img) => img.closest("[data-slot=message]")?.textContent);

    const { rerender } = render(
      <MessageList
        messages={run}
        partnerStatus="online"
        onReact={() => {}}
        onReply={() => {}}
        self={SELF}
        partner={PARTNER}
      />,
    );
    expect(avatarRows()).toEqual(["two", "three"]);

    // A typing bubble continues the run, so the avatar moves down to it.
    rerender(
      <MessageList
        messages={run}
        partnerStatus="typing"
        onReact={() => {}}
        onReply={() => {}}
        self={SELF}
        partner={PARTNER}
      />,
    );
    expect(avatarRows()).toEqual(["two", "Partner is typing"]);
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

  it("pops an own send in once, not again when the ack swaps its id", () => {
    function list(messages: ChatMessage[]) {
      return (
        <MessageList
          messages={messages}
          partnerStatus="online"
          onReact={() => {}}
          onReply={() => {}}
          self={SELF}
          partner={PARTNER}
        />
      );
    }
    const { container, rerender } = render(list([]));
    const optimistic = makeMessage({
      id: "tmp-1",
      author: "self",
      delivery: "sending",
    });
    rerender(list([optimistic]));
    expect(
      container.querySelector('[data-message-id="tmp-1"]')?.className,
    ).toContain("animate-chat-bubble-in");

    rerender(list([makeMessage({ id: "s-1", author: "self" })]));
    expect(
      container.querySelector('[data-message-id="s-1"]')?.className,
    ).not.toContain("animate-chat-bubble-in");
  });
});
