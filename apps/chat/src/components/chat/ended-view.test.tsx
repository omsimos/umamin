import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EndedView } from "./ended-view";

describe("EndedView", () => {
  it("shows '<alias> left' when the partner left and an alias is known", () => {
    render(
      <EndedView
        reason="partner-left"
        partnerAlias="Quiet Fox"
        onFindNew={() => {}}
        onBackToLobby={() => {}}
      />,
    );
    expect(screen.getByText("Quiet Fox left")).toBeInTheDocument();
  });

  it("falls back to 'Chat ended' without a partner-left alias", () => {
    render(
      <EndedView
        reason={undefined}
        partnerAlias={undefined}
        onFindNew={() => {}}
        onBackToLobby={() => {}}
      />,
    );
    expect(screen.getByText("Chat ended")).toBeInTheDocument();
  });

  it("invokes the action callbacks", async () => {
    const onFindNew = vi.fn();
    const onBackToLobby = vi.fn();
    render(
      <EndedView
        reason="partner-left"
        partnerAlias="Fox"
        onFindNew={onFindNew}
        onBackToLobby={onBackToLobby}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /find someone new/i }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /back to lobby/i }),
    );
    expect(onFindNew).toHaveBeenCalledTimes(1);
    expect(onBackToLobby).toHaveBeenCalledTimes(1);
  });
});
