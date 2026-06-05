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

const SELF = { alias: "Calm Otter", avatarSeed: "self-seed" };
const PARTNER = { alias: "Blue Fox", avatarSeed: "partner-seed" };

function renderBubble(message: ChatMessage, onReact: () => void = () => {}) {
  return render(
    <MessageBubble
      message={message}
      onReact={onReact}
      self={SELF}
      partner={PARTNER}
    />,
  );
}

const BUBBLE_NAME = /^They said: hello there\./;

describe("MessageBubble", () => {
  it("toggles the reaction picker when the bubble is clicked", async () => {
    renderBubble(makeMessage());

    expect(screen.queryByRole("button", { name: /^React / })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: BUBBLE_NAME }));
    expect(
      screen.getAllByRole("button", { name: /^React / }).length,
    ).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: BUBBLE_NAME }));
    expect(screen.queryByRole("button", { name: /^React / })).toBeNull();
  });

  it("calls onReact and closes the picker when an emoji is chosen", async () => {
    const onReact = vi.fn();
    renderBubble(makeMessage(), onReact);

    await userEvent.click(screen.getByRole("button", { name: BUBBLE_NAME }));
    const emojiButton = screen.getAllByRole("button", { name: /^React / })[0];
    await userEvent.click(emojiButton);

    expect(onReact).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /^React / })).toBeNull();
  });

  it("renders reactions only when the message has them", () => {
    const { rerender } = renderBubble(makeMessage());
    expect(screen.queryByRole("button", { name: "View reactions" })).toBeNull();

    rerender(
      <MessageBubble
        message={makeMessage({ reactions: [{ emoji: "🔥", by: "partner" }] })}
        onReact={() => {}}
        self={SELF}
        partner={PARTNER}
      />,
    );
    const badge = screen.getByRole("button", { name: "View reactions" });
    expect(badge).toHaveTextContent("🔥");
  });

  it("groups a shared emoji into one badge entry with a counter", () => {
    renderBubble(
      makeMessage({
        reactions: [
          { emoji: "❤️", by: "self" },
          { emoji: "❤️", by: "partner" },
        ],
      }),
    );
    const badge = screen.getByRole("button", { name: "View reactions" });
    expect(badge.textContent).toBe("❤️2");
  });

  it("opens the reaction details listing who reacted with what", async () => {
    renderBubble(
      makeMessage({
        reactions: [
          { emoji: "❤️", by: "self" },
          { emoji: "🔥", by: "partner" },
        ],
      }),
    );

    await userEvent.click(
      screen.getByRole("button", { name: "View reactions" }),
    );

    const details = await screen.findByRole("dialog");
    expect(details).toHaveTextContent("Calm Otter");
    expect(details).toHaveTextContent("(you)");
    expect(details).toHaveTextContent("Blue Fox");
    expect(details).toHaveTextContent("❤️");
    expect(details).toHaveTextContent("🔥");
  });

  it("marks the user's current reaction as pressed in the picker", async () => {
    renderBubble(makeMessage({ reactions: [{ emoji: "❤️", by: "self" }] }));

    await userEvent.click(screen.getByRole("button", { name: BUBBLE_NAME }));
    expect(screen.getByRole("button", { name: "React ❤️" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "React 🔥" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
