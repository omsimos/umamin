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

describe("ChatHeader", () => {
  it("calls onStayConnected when the heart button is clicked", async () => {
    const onStayConnected = vi.fn();
    render(
      <ChatHeader
        partner={makePartner()}
        stayConnectedActive={false}
        onStayConnected={onStayConnected}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Stay connected" }),
    );
    expect(onStayConnected).toHaveBeenCalledTimes(1);
  });

  it("activates the heart styling when stayConnectedActive is true", () => {
    const { rerender } = render(
      <ChatHeader
        partner={makePartner()}
        stayConnectedActive={false}
        onStayConnected={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Stay connected" }).className,
    ).not.toContain("text-primary");

    rerender(
      <ChatHeader
        partner={makePartner()}
        stayConnectedActive={true}
        onStayConnected={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Stay connected" }).className,
    ).toContain("text-primary");
  });

  it("shows 'online', 'typing…', 'away' or 'left' based on partner status", () => {
    const byStatusText = (text: string) => (_: string, el: Element | null) =>
      el?.tagName === "P" && el.textContent?.trim() === text;

    const { rerender } = render(
      <ChatHeader
        partner={makePartner({ status: "online" })}
        stayConnectedActive={false}
        onStayConnected={() => {}}
      />,
    );
    expect(screen.getByText(byStatusText("● online"))).toBeInTheDocument();

    rerender(
      <ChatHeader
        partner={makePartner({ status: "typing" })}
        stayConnectedActive={false}
        onStayConnected={() => {}}
      />,
    );
    expect(screen.getByText(byStatusText("● typing…"))).toBeInTheDocument();

    rerender(
      <ChatHeader
        partner={makePartner({ status: "away" })}
        stayConnectedActive={false}
        onStayConnected={() => {}}
      />,
    );
    expect(screen.getByText(byStatusText("● away"))).toBeInTheDocument();

    rerender(
      <ChatHeader
        partner={makePartner({ status: "left" })}
        stayConnectedActive={false}
        onStayConnected={() => {}}
      />,
    );
    expect(screen.getByText(byStatusText("● left"))).toBeInTheDocument();
  });

  it("tones the status line per state (emerald online, amber away, muted left)", () => {
    const statusP = (text: string) =>
      screen.getByText(
        (_: string, el: Element | null) =>
          el?.tagName === "P" && el.textContent?.trim() === text,
      );

    const { rerender } = render(
      <ChatHeader
        partner={makePartner({ status: "online" })}
        stayConnectedActive={false}
        onStayConnected={() => {}}
      />,
    );
    expect(statusP("● online").className).toContain("text-emerald-600");

    rerender(
      <ChatHeader
        partner={makePartner({ status: "away" })}
        stayConnectedActive={false}
        onStayConnected={() => {}}
      />,
    );
    expect(statusP("● away").className).toContain("text-amber-600");

    rerender(
      <ChatHeader
        partner={makePartner({ status: "left" })}
        stayConnectedActive={false}
        onStayConnected={() => {}}
      />,
    );
    expect(statusP("● left").className).toContain("text-muted-foreground");
  });

  it("shows the game tally chip only once a round has completed", () => {
    const { rerender } = render(
      <ChatHeader
        partner={makePartner()}
        stayConnectedActive={false}
        onStayConnected={() => {}}
        gameTally={{ rounds: 0, matched: 0 }}
      />,
    );
    expect(screen.queryByText(/0\/0/)).toBeNull();

    rerender(
      <ChatHeader
        partner={makePartner()}
        stayConnectedActive={false}
        onStayConnected={() => {}}
        gameTally={{ rounds: 3, matched: 2 }}
      />,
    );
    expect(screen.getByText(/2\/3/)).toBeInTheDocument();
  });

  it("shows the shared-interest badge only when present", () => {
    const { rerender } = render(
      <ChatHeader
        partner={makePartner({ sharedInterests: ["music"] })}
        stayConnectedActive={false}
        onStayConnected={() => {}}
      />,
    );
    expect(screen.getByText(/Music/)).toBeInTheDocument();

    rerender(
      <ChatHeader
        partner={makePartner({ sharedInterests: [] })}
        stayConnectedActive={false}
        onStayConnected={() => {}}
      />,
    );
    expect(screen.queryByText(/Music/)).toBeNull();
  });
});
