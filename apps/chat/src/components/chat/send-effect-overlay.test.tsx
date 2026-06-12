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

  it("uses heart emojis for the hearts effect", () => {
    render(<SendEffectOverlay effect="hearts" onDone={() => {}} />);
    expect(screen.getByTestId("send-effect-overlay").textContent).toContain(
      "💖",
    );
  });
});
