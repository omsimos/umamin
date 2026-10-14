import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SendEffectOverlay } from "./send-effect-overlay";

describe("SendEffectOverlay", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("renders particles and calls onDone after the effect duration", () => {
    const onDone = vi.fn();
    render(<SendEffectOverlay effect="confetti" onDone={onDone} />);
    expect(screen.getByTestId("send-effect-overlay")).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2000);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  // The session re-renders on every frame (typing, presence) with a new
  // onDone; that must not keep pushing the end of the effect out.
  it("finishes on schedule while the parent re-renders with new callbacks", () => {
    const onDone = vi.fn();
    const { rerender } = render(
      <SendEffectOverlay effect="confetti" onDone={() => onDone()} />,
    );
    for (let i = 0; i < 4; i++) {
      vi.advanceTimersByTime(500);
      rerender(<SendEffectOverlay effect="confetti" onDone={() => onDone()} />);
    }
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("uses heart emojis for the hearts effect", () => {
    render(<SendEffectOverlay effect="hearts" onDone={() => {}} />);
    expect(screen.getByTestId("send-effect-overlay").textContent).toContain(
      "💖",
    );
  });
});
