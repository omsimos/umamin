import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { UiDmMessage } from "@/lib/dm/client-state";
import { DmMessageBubble } from "./dm-message-bubble";

const message: UiDmMessage = {
  id: "4",
  mine: false,
  text: "hey",
  replyTo: null,
  myReaction: null,
  theirReaction: null,
  createdAt: 1,
};

describe("DmMessageBubble", () => {
  it("opens the report flow only after the options menu has closed", async () => {
    let menuOpenAtReport: boolean | null = null;
    const onReport = vi.fn(() => {
      menuOpenAtReport =
        screen.queryByRole("dialog", { name: "Message options" }) !== null;
    });
    render(
      <DmMessageBubble
        message={message}
        peerName="bob"
        highlighted={false}
        seen={false}
        canInteract
        onReact={vi.fn()}
        onReply={vi.fn()}
        onUnsend={vi.fn()}
        onReport={onReport}
        onJumpTo={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /bob said: hey/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Report" }));

    await waitFor(() => expect(onReport).toHaveBeenCalledTimes(1));
    expect(menuOpenAtReport).toBe(false);
  });
});
