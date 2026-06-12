import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Partner } from "../../lib/session/types";
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
    vibe: { score: 0, level: 1 },
    stayConnectedActive: false,
    onStayConnected: () => {},
    onShowVibe: () => {},
    ...overrides,
  };
  return render(<ChatHeader {...props} />);
}

const statusSpan = (text: string) =>
  screen.getByText(
    (_: string, el: Element | null) =>
      el?.tagName === "SPAN" &&
      el.textContent?.trim() === text &&
      el.className.includes("text-[11px]"),
  );

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
      ["online", "● online"],
      ["typing", "● typing…"],
      ["away", "● away"],
      ["left", "● left"],
    ] as const) {
      const { unmount } = renderHeader({ partner: makePartner({ status }) });
      expect(statusSpan(label)).toBeInTheDocument();
      unmount();
    }
  });

  it("tones the status line per state (emerald online, amber away, muted left)", () => {
    for (const [status, label, tone] of [
      ["online", "● online", "text-emerald-600"],
      ["away", "● away", "text-amber-600"],
      ["left", "● left", "text-muted-foreground"],
    ] as const) {
      const { unmount } = renderHeader({ partner: makePartner({ status }) });
      expect(statusSpan(label).className).toContain(tone);
      unmount();
    }
  });

  it("opens the vibe sheet from the partner cluster", async () => {
    const onShowVibe = vi.fn();
    renderHeader({ onShowVibe, vibe: { score: 30, level: 2 } });
    await userEvent.click(
      screen.getByRole("button", { name: /Vibe level 2 with Quiet Fox/ }),
    );
    expect(onShowVibe).toHaveBeenCalledTimes(1);
  });

  it("renders the vibe ring at the partner's level", () => {
    renderHeader({ vibe: { score: 60, level: 3 } });
    expect(screen.getByTestId("vibe-ring")).toHaveAttribute("data-level", "3");
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
