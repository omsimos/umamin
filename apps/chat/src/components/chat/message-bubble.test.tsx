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

function renderBubble(
  message: ChatMessage,
  {
    onReact = () => {},
    onReply = () => {},
    onJumpTo,
  }: {
    onReact?: () => void;
    onReply?: () => void;
    onJumpTo?: (id: string) => void;
  } = {},
) {
  return render(
    <MessageBubble
      message={message}
      onReact={onReact}
      onReply={onReply}
      onJumpTo={onJumpTo}
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
    renderBubble(makeMessage(), { onReact });

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
        onReply={() => {}}
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

  it("calls onReply and closes the popover when Reply is chosen", async () => {
    const onReply = vi.fn();
    renderBubble(makeMessage(), { onReply });

    await userEvent.click(screen.getByRole("button", { name: BUBBLE_NAME }));
    await userEvent.click(screen.getByRole("button", { name: "Reply" }));

    expect(onReply).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Reply" })).toBeNull();
  });

  it("renders the quoted reply preview with a viewer-relative label", () => {
    renderBubble(
      makeMessage({
        replyTo: { id: "m0", author: "self", text: "the original" },
      }),
    );
    expect(screen.getByText("Blue Fox replied to you")).toBeInTheDocument();
    expect(screen.getByText("the original")).toBeInTheDocument();
  });

  it("labels a self-reply to the partner's message", () => {
    renderBubble(
      makeMessage({
        author: "self",
        replyTo: { id: "m0", author: "partner", text: "the original" },
      }),
    );
    expect(screen.getByText("You replied to Blue Fox")).toBeInTheDocument();
  });

  it("jumps to the quoted message when the preview is tapped", async () => {
    const onJumpTo = vi.fn();
    renderBubble(
      makeMessage({
        replyTo: { id: "m0", author: "self", text: "the original" },
      }),
      { onJumpTo },
    );
    await userEvent.click(
      screen.getByRole("button", { name: /^Go to replied-to message/ }),
    );
    expect(onJumpTo).toHaveBeenCalledWith("m0");
  });

  it("hides a received whisper's text and reveals on tap", async () => {
    const onViewWhisper = vi.fn();
    render(
      <MessageBubble
        message={makeMessage({ text: "", whisper: { state: "hidden" } })}
        onReact={() => {}}
        onReply={() => {}}
        onViewWhisper={onViewWhisper}
        self={SELF}
        partner={PARTNER}
      />,
    );
    expect(screen.queryByText("hello there")).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: /^Whisper received/ }),
    );
    expect(onViewWhisper).toHaveBeenCalledWith("m1");
  });

  it("shows the sender's own whisper text with an unseen caption", () => {
    render(
      <MessageBubble
        message={makeMessage({
          author: "self",
          text: "my secret",
          whisper: { state: "hidden" },
        })}
        onReact={() => {}}
        onReply={() => {}}
        self={SELF}
        partner={PARTNER}
      />,
    );
    expect(screen.getByText("my secret")).toBeInTheDocument();
    expect(screen.getByText(/Whisper · unseen/)).toBeInTheDocument();
  });

  it("shows a countdown for a revealed whisper and a placeholder once burned", () => {
    const { rerender } = render(
      <MessageBubble
        message={makeMessage({
          whisper: { state: "revealed", viewedAt: Date.now() },
        })}
        onReact={() => {}}
        onReply={() => {}}
        self={SELF}
        partner={PARTNER}
      />,
    );
    expect(screen.getByText("hello there")).toBeInTheDocument();
    expect(screen.getByText(/burns in \d+s/)).toBeInTheDocument();

    rerender(
      <MessageBubble
        message={makeMessage({ text: "", whisper: { state: "burned" } })}
        onReact={() => {}}
        onReply={() => {}}
        self={SELF}
        partner={PARTNER}
      />,
    );
    expect(screen.getByText(/Whisper burned/)).toBeInTheDocument();
    expect(screen.queryByText("hello there")).toBeNull();
  });

  it("renders a game-result row with both picks and the verdict", () => {
    renderBubble(
      makeMessage({
        text: "",
        gameResult: { cardId: "tot-coffee", selfPick: "A", partnerPick: "A" },
      }),
    );
    expect(screen.getByText(/This or That/)).toBeInTheDocument();
    expect(
      screen.getByText("You: Coffee · Blue Fox: Coffee"),
    ).toBeInTheDocument();
    expect(screen.getByText("⚡ It's a match!")).toBeInTheDocument();
  });

  it("renders a mismatch verdict and no popover on game rows", async () => {
    renderBubble(
      makeMessage({
        text: "",
        gameResult: { cardId: "tot-coffee", selfPick: "A", partnerPick: "B" },
      }),
    );
    expect(screen.getByText(/Opposites attract/)).toBeInTheDocument();
    await userEvent.click(screen.getByText(/Opposites attract/));
    expect(screen.queryByRole("button", { name: /^React / })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reply" })).toBeNull();
  });

  it("renders nothing for a game row with an unknown card", () => {
    const { container } = renderBubble(
      makeMessage({
        text: "",
        gameResult: { cardId: "nope", selfPick: "A", partnerPick: "B" },
      }),
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("whispers have no reaction/reply popover", async () => {
    render(
      <MessageBubble
        message={makeMessage({
          author: "self",
          text: "my secret",
          whisper: { state: "hidden" },
        })}
        onReact={() => {}}
        onReply={() => {}}
        self={SELF}
        partner={PARTNER}
      />,
    );
    await userEvent.click(screen.getByText("my secret"));
    expect(screen.queryByRole("button", { name: /^React / })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reply" })).toBeNull();
  });
});
