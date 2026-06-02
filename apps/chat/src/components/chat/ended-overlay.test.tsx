import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EndedOverlay } from "./ended-overlay";

describe("EndedOverlay", () => {
  it("shows '<alias> left' when the partner left and an alias is known", () => {
    render(
      <EndedOverlay
        reason="partner-left"
        partnerAlias="Quiet Fox"
        onFindNew={() => {}}
        onBackToLobby={() => {}}
      />,
    );
    expect(screen.getByText("Quiet Fox left")).toBeInTheDocument();
  });

  it("falls back to 'Chat ended' when the partner left but no alias is known", () => {
    render(
      <EndedOverlay
        reason="partner-left"
        partnerAlias={undefined}
        onFindNew={() => {}}
        onBackToLobby={() => {}}
      />,
    );
    expect(screen.getByText("Chat ended")).toBeInTheDocument();
    expect(screen.queryByText(/left$/)).toBeNull();
  });

  it("falls back to 'Chat ended' for non-partner-left reasons even with an alias", () => {
    render(
      <EndedOverlay
        reason="self-ended"
        partnerAlias="Quiet Fox"
        onFindNew={() => {}}
        onBackToLobby={() => {}}
      />,
    );
    expect(screen.getByText("Chat ended")).toBeInTheDocument();
  });

  it("calls onFindNew when the primary button is clicked", async () => {
    const onFindNew = vi.fn();
    render(
      <EndedOverlay
        reason="self-ended"
        partnerAlias={undefined}
        onFindNew={onFindNew}
        onBackToLobby={() => {}}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /find someone new/i }),
    );
    expect(onFindNew).toHaveBeenCalledTimes(1);
  });

  it("calls onBackToLobby when the secondary button is clicked", async () => {
    const onBackToLobby = vi.fn();
    render(
      <EndedOverlay
        reason="self-ended"
        partnerAlias={undefined}
        onFindNew={() => {}}
        onBackToLobby={onBackToLobby}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /back to lobby/i }),
    );
    expect(onBackToLobby).toHaveBeenCalledTimes(1);
  });
});
