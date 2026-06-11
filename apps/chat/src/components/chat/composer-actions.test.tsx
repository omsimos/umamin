import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GAME_DECKS } from "../../../convex/decks";
import { ComposerActions, IDLE_MODE } from "./composer-actions";

describe("ComposerActions", () => {
  it("deals a random card from the chosen deck", async () => {
    const onDealCard = vi.fn();
    render(
      <ComposerActions
        mode={IDLE_MODE}
        onModeChange={() => {}}
        onDealCard={onDealCard}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Message options" }),
    );
    await userEvent.click(screen.getByRole("button", { name: /This or That/ }));
    expect(onDealCard).toHaveBeenCalledTimes(1);
    const dealt = onDealCard.mock.calls[0][0];
    expect(GAME_DECKS["this-or-that"].some((c) => c.id === dealt)).toBe(true);
  });

  it("hides game rows when onDealCard is absent", async () => {
    render(<ComposerActions mode={IDLE_MODE} onModeChange={() => {}} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Message options" }),
    );
    expect(screen.queryByRole("button", { name: /This or That/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Whisper/ })).toBeInTheDocument();
  });

  it("toggles whisper mode", async () => {
    const onModeChange = vi.fn();
    render(<ComposerActions mode={IDLE_MODE} onModeChange={onModeChange} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Message options" }),
    );
    await userEvent.click(screen.getByRole("button", { name: /Whisper/ }));
    expect(onModeChange).toHaveBeenCalledWith({ whisper: true });
  });
});
