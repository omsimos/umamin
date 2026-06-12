import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HandleRevealOverlay } from "./handle-reveal-overlay";

const SELF = { alias: "Calm Otter", avatarSeed: "self-seed" };
const PARTNER = { alias: "Blue Fox", avatarSeed: "partner-seed" };

function renderOverlay(onClose = () => {}) {
  return render(
    <HandleRevealOverlay
      self={SELF}
      partner={PARTNER}
      selfHandle="@otter"
      partnerHandle="@fox"
      onClose={onClose}
    />,
  );
}

describe("HandleRevealOverlay", () => {
  it("shows both handles with copy actions and the save warning", () => {
    renderOverlay();
    expect(screen.getByText("You found each other.")).toBeInTheDocument();
    expect(screen.getByText("@otter")).toBeInTheDocument();
    expect(screen.getByText("@fox")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Copy/ })).toHaveLength(2);
    expect(screen.getByText(/they vanish with the chat/)).toBeInTheDocument();
  });

  it("closes via keep chatting", async () => {
    const onClose = vi.fn();
    renderOverlay(onClose);
    await userEvent.click(
      screen.getByRole("button", { name: "Keep chatting" }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
