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

  it("shows 'online' or 'typing…' based on partner status", () => {
    const { rerender } = render(
      <ChatHeader
        partner={makePartner({ status: "online" })}
        stayConnectedActive={false}
        onStayConnected={() => {}}
      />,
    );
    expect(screen.getByText("● online")).toBeInTheDocument();

    rerender(
      <ChatHeader
        partner={makePartner({ status: "typing" })}
        stayConnectedActive={false}
        onStayConnected={() => {}}
      />,
    );
    expect(screen.getByText("● typing…")).toBeInTheDocument();
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
