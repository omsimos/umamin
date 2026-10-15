import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  it("starts the chosen game and closes the sheet", async () => {
    const onPlay = vi.fn();
    render(
      <ComposerActions
        mode={IDLE_MODE}
        onModeChange={() => {}}
        onPlay={onPlay}
      />,
    );
    await openActions();
    await userEvent.click(screen.getByRole("button", { name: /Hot Takes/ }));
    expect(onPlay).toHaveBeenCalledWith("hot-takes");
    expect(screen.queryByRole("button", { name: /Mind Reader/ })).toBeNull();

    await openActions();
    await userEvent.click(screen.getByRole("button", { name: /Mind Reader/ }));
    expect(onPlay).toHaveBeenLastCalledWith("mind-reader");
  });

  it("hides the play section when onPlay is absent", async () => {
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

  it("arms an effect, and picking the armed one again clears it", async () => {
    const onModeChange = vi.fn();
    const { rerender } = render(
      <ComposerActions mode={IDLE_MODE} onModeChange={onModeChange} />,
    );
    await openActions();
    await userEvent.click(
      screen.getByRole("button", { name: "Send with golden hearts" }),
    );
    expect(onModeChange).toHaveBeenLastCalledWith({
      whisper: false,
      effect: "golden",
    });

    rerender(
      <ComposerActions
        mode={{ whisper: false, effect: "golden" }}
        onModeChange={onModeChange}
      />,
    );
    await openActions();
    await userEvent.click(
      screen.getByRole("button", { name: "Send with golden hearts" }),
    );
    expect(onModeChange).toHaveBeenLastCalledWith(IDLE_MODE);
  });
});
