import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Partner } from "@/lib/chat/types";
import { ChatHeader } from "./chat-header";

function makePartner(overrides: Partial<Partner> = {}): Partner {
  return {
    alias: "Quiet Fox",
    avatarSeed: "seed",
    sharedInterests: ["music"],
    status: "online",
    ...overrides,
  };
}

type Props = Parameters<typeof ChatHeader>[0];

function renderHeader(overrides: Partial<Props> = {}) {
  const props: Props = {
    partner: makePartner(),
    stayConnectedActive: false,
    onStayConnected: () => {},
    onNewMatch: () => {},
    onEndChat: () => {},
    ...overrides,
  };
  return render(<ChatHeader {...props} />);
}

describe("ChatHeader", () => {
  it("calls onStayConnected when the heart button is clicked", async () => {
    const onStayConnected = vi.fn();
    renderHeader({ onStayConnected });
    await userEvent.click(
      screen.getByRole("button", { name: "Stay connected" }),
    );
    expect(onStayConnected).toHaveBeenCalledTimes(1);
  });

  it("activates the heart styling when stayConnectedActive is true", () => {
    const { unmount } = renderHeader({ stayConnectedActive: false });
    expect(
      screen.getByRole("button", { name: "Stay connected" }).className,
    ).not.toContain("text-primary");
    unmount();

    renderHeader({ stayConnectedActive: true });
    expect(
      screen.getByRole("button", { name: "Stay connected" }).className,
    ).toContain("text-primary");
  });

  it("shows 'online', 'typing…', 'away' or 'left' based on partner status", () => {
    for (const [status, label] of [
      ["online", "online"],
      ["typing", "typing…"],
      ["away", "away"],
      ["left", "left"],
    ] as const) {
      const { unmount } = renderHeader({ partner: makePartner({ status }) });
      expect(screen.getByText(label, { exact: true })).toBeInTheDocument();
      unmount();
    }
  });

  it("ends the chat from the back button only after confirming", async () => {
    const onEndChat = vi.fn();
    renderHeader({ onEndChat });
    await userEvent.click(screen.getByRole("button", { name: "End chat" }));
    expect(onEndChat).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: "Keep chatting" }),
    );
    expect(onEndChat).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "End chat" }));
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "End chat",
      }),
    );
    expect(onEndChat).toHaveBeenCalledTimes(1);
  });

  it("starts a new match from the options menu without a confirm", async () => {
    const onNewMatch = vi.fn();
    renderHeader({ onNewMatch });
    await userEvent.click(screen.getByRole("button", { name: "Chat options" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "New match" }),
    );
    expect(onNewMatch).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("shows the combo chip only while a streak of 2+ is live", () => {
    const { unmount } = renderHeader({
      gameStreak: { current: 1, best: 4 },
    });
    expect(screen.queryByText(/🔥×/)).toBeNull();
    unmount();

    renderHeader({ gameStreak: { current: 3, best: 3 } });
    expect(screen.getByText("🔥×3")).toBeInTheDocument();
  });

  it("shows the shared-interest badge only when present", () => {
    const { unmount } = renderHeader({
      partner: makePartner({ sharedInterests: ["music"] }),
    });
    expect(screen.getByText(/Music/)).toBeInTheDocument();
    unmount();

    renderHeader({ partner: makePartner({ sharedInterests: [] }) });
    expect(screen.queryByText(/Music/)).toBeNull();
  });
});
