import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DmComposer } from "./dm-composer";

const noop = () => {};

describe("DmComposer typing", () => {
  it("keeps typing on when the parent re-renders with the same handler", async () => {
    const onTyping = vi.fn();
    const { rerender } = render(
      <DmComposer
        onSend={noop}
        onTyping={onTyping}
        replyTo={null}
        onCancelReply={noop}
      />,
    );
    await userEvent.type(screen.getByRole("textbox"), "hey");
    expect(onTyping).toHaveBeenLastCalledWith(true);

    rerender(
      <DmComposer
        onSend={() => {}}
        onTyping={onTyping}
        replyTo={null}
        onCancelReply={noop}
      />,
    );
    expect(onTyping).not.toHaveBeenCalledWith(false);
  });

  it("sends typing off through the old handler when the handler changes", async () => {
    const first = vi.fn();
    const { rerender } = render(
      <DmComposer
        onSend={noop}
        onTyping={first}
        replyTo={null}
        onCancelReply={noop}
      />,
    );
    await userEvent.type(screen.getByRole("textbox"), "hey");
    expect(first).toHaveBeenLastCalledWith(true);

    rerender(
      <DmComposer
        onSend={noop}
        onTyping={vi.fn()}
        replyTo={null}
        onCancelReply={noop}
      />,
    );
    expect(first).toHaveBeenLastCalledWith(false);
  });
});

describe("DmComposer reply focus", () => {
  it("focuses once per reply target, not on every re-render", async () => {
    const reply = { authorLabel: "Sam", text: "earlier" };
    const { rerender } = render(
      <DmComposer
        onSend={noop}
        onTyping={noop}
        replyTo={reply}
        onCancelReply={noop}
      />,
    );
    const textbox = screen.getByRole("textbox");
    expect(textbox).toHaveFocus();

    await userEvent.tab();
    expect(textbox).not.toHaveFocus();

    rerender(
      <DmComposer
        onSend={noop}
        onTyping={noop}
        replyTo={reply}
        onCancelReply={noop}
      />,
    );
    expect(textbox).not.toHaveFocus();

    rerender(
      <DmComposer
        onSend={noop}
        onTyping={noop}
        replyTo={{ authorLabel: "Sam", text: "another" }}
        onCancelReply={noop}
      />,
    );
    expect(textbox).toHaveFocus();
  });
});
