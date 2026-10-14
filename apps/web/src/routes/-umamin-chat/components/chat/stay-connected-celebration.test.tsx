import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StayConnectedCelebration } from "./stay-connected-celebration";

function renderCelebration(onContinue = () => {}) {
  return render(
    <StayConnectedCelebration
      selfAlias="Night Owl"
      selfSeed="self-seed"
      partnerAlias="Quiet Fox"
      partnerSeed="partner-seed"
      onContinue={onContinue}
    />,
  );
}

describe("StayConnectedCelebration", () => {
  it("names the partner in the body copy", () => {
    renderCelebration();
    expect(
      screen.getByText("You and Quiet Fox both want to keep talking."),
    ).toBeInTheDocument();
  });

  it("renders both avatars", () => {
    renderCelebration();
    expect(screen.getByLabelText("Night Owl")).toBeInTheDocument();
    expect(screen.getByLabelText("Quiet Fox")).toBeInTheDocument();
  });

  it("calls onContinue when 'Keep chatting' is clicked", async () => {
    const onContinue = vi.fn();
    renderCelebration(onContinue);
    await userEvent.click(
      screen.getByRole("button", { name: /keep chatting/i }),
    );
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
