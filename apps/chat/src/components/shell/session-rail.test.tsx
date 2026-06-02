import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SessionRail } from "./session-rail";

function renderRail(
  overrides: Partial<{
    onNewMatch: () => void;
    onEndChat: () => void;
    onReport: () => void;
  }> = {},
) {
  const onNewMatch = overrides.onNewMatch ?? vi.fn();
  const onEndChat = overrides.onEndChat ?? vi.fn();
  const onReport = overrides.onReport ?? vi.fn();
  render(
    <SessionRail
      selfAlias="Quiet Fox"
      selfSeed="seed"
      onNewMatch={onNewMatch}
      onEndChat={onEndChat}
      onReport={onReport}
    />,
  );
  return { onNewMatch, onEndChat, onReport };
}

describe("SessionRail", () => {
  it("calls onNewMatch directly without a confirm dialog", async () => {
    const { onNewMatch } = renderRail();
    await userEvent.click(screen.getByRole("button", { name: "New match" }));
    expect(onNewMatch).toHaveBeenCalledTimes(1);
  });

  it("fires onEndChat only after confirming the end-chat dialog", async () => {
    const { onEndChat } = renderRail();
    await userEvent.click(screen.getByRole("button", { name: "End chat" }));
    expect(onEndChat).not.toHaveBeenCalled();

    const dialog = screen.getByRole("alertdialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "End chat" }),
    );
    expect(onEndChat).toHaveBeenCalledTimes(1);
  });

  it("does not fire onEndChat when the end-chat dialog is cancelled", async () => {
    const { onEndChat } = renderRail();
    await userEvent.click(screen.getByRole("button", { name: "End chat" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onEndChat).not.toHaveBeenCalled();
  });

  it("fires onReport only after confirming the report dialog", async () => {
    const { onReport } = renderRail();
    await userEvent.click(screen.getByRole("button", { name: "Report" }));
    expect(onReport).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: "Report & skip" }),
    );
    expect(onReport).toHaveBeenCalledTimes(1);
  });

  it("does not fire onReport when the report dialog is cancelled", async () => {
    const { onReport } = renderRail();
    await userEvent.click(screen.getByRole("button", { name: "Report" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onReport).not.toHaveBeenCalled();
  });
});
