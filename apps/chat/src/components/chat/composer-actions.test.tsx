import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GAME_DECKS } from "../../../convex/decks";
import { ComposerActions, IDLE_MODE } from "./composer-actions";

// Run on the desktop (popover) path: vaul's drawer leaves aria-hidden/state
// behind after close in jsdom, which breaks any assertion outside it. The
// drawer body is the exact same ActionsBody.
const originalMatchMedia = window.matchMedia;
beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});
afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

async function openActions() {
  await userEvent.click(
    screen.getByRole("button", { name: "Message options" }),
  );
}

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
    await openActions();
    await userEvent.click(screen.getByRole("button", { name: /This or That/ }));
    expect(onDealCard).toHaveBeenCalledTimes(1);
    const dealt = onDealCard.mock.calls[0][0];
    expect(GAME_DECKS["this-or-that"].some((c) => c.id === dealt)).toBe(true);
  });

  it("hides the play section when onDealCard is absent", async () => {
    render(<ComposerActions mode={IDLE_MODE} onModeChange={() => {}} />);
    await openActions();
    expect(screen.queryByRole("button", { name: /This or That/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Whisper/ })).toBeInTheDocument();
  });

  it("toggles whisper mode", async () => {
    const onModeChange = vi.fn();
    render(<ComposerActions mode={IDLE_MODE} onModeChange={onModeChange} />);
    await openActions();
    await userEvent.click(screen.getByRole("button", { name: /Whisper/ }));
    expect(onModeChange).toHaveBeenCalledWith({ whisper: true });
  });

  it("locked tiles explain instead of dealing, and offer the vibe sheet", async () => {
    const onDealCard = vi.fn();
    const onShowVibe = vi.fn();
    render(
      <ComposerActions
        mode={IDLE_MODE}
        onModeChange={() => {}}
        onDealCard={onDealCard}
        vibeLevel={1}
        onShowVibe={onShowVibe}
      />,
    );
    await openActions();
    await userEvent.click(
      screen.getByRole("button", {
        name: /Hot Takes — unlocks at vibe level 3/,
      }),
    );
    expect(onDealCard).not.toHaveBeenCalled();
  });

  it("unlocked decks and Mind Reader deal at a sufficient level", async () => {
    const onDealCard = vi.fn();
    render(
      <ComposerActions
        mode={IDLE_MODE}
        onModeChange={() => {}}
        onDealCard={onDealCard}
        vibeLevel={3}
      />,
    );
    await openActions();
    await userEvent.click(screen.getByRole("button", { name: "Hot Takes" }));
    expect(
      GAME_DECKS["hot-takes"].some((c) => c.id === onDealCard.mock.calls[0][0]),
    ).toBe(true);

    await openActions();
    await userEvent.click(screen.getByRole("button", { name: "Mind Reader" }));
    expect(onDealCard).toHaveBeenLastCalledWith(expect.any(String), "guess");
  });

  it("locked effects don't arm a send mode", async () => {
    const onModeChange = vi.fn();
    render(
      <ComposerActions
        mode={IDLE_MODE}
        onModeChange={onModeChange}
        vibeLevel={1}
      />,
    );
    await openActions();
    await userEvent.click(
      screen.getByRole("button", {
        name: /Send with sparkles — unlocks at vibe level 3/,
      }),
    );
    expect(onModeChange).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: "Send with confetti" }),
    );
    expect(onModeChange).toHaveBeenCalledWith({
      whisper: false,
      effect: "confetti",
    });
  });
});
