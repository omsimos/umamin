import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ICE_BREAKER_PROMPTS } from "../../lib/mock/data";
import { IceBreakerBanner } from "./ice-breaker-banner";

describe("IceBreakerBanner", () => {
  it("calls onPrompt with the chip text", async () => {
    const onPrompt = vi.fn();
    render(
      <IceBreakerBanner
        sharedInterests={[]}
        onPrompt={onPrompt}
        onDismiss={() => {}}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: ICE_BREAKER_PROMPTS[0] }),
    );
    expect(onPrompt).toHaveBeenCalledWith(ICE_BREAKER_PROMPTS[0]);
  });

  it("calls onDismiss when the dismiss button is clicked", async () => {
    const onDismiss = vi.fn();
    render(
      <IceBreakerBanner
        sharedInterests={[]}
        onPrompt={() => {}}
        onDismiss={onDismiss}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Dismiss ice-breaker" }),
    );
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("composes the shared-interest label from the interest ids", () => {
    render(
      <IceBreakerBanner
        sharedInterests={["music", "gaming"]}
        onPrompt={() => {}}
        onDismiss={() => {}}
      />,
    );
    expect(
      screen.getByText("You both like Music & Gaming"),
    ).toBeInTheDocument();
  });

  it("falls back to a greeting when there are no shared interests", () => {
    render(
      <IceBreakerBanner
        sharedInterests={[]}
        onPrompt={() => {}}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText("Say hi 👋")).toBeInTheDocument();
    expect(screen.queryByText(/You both like/)).toBeNull();
  });
});
