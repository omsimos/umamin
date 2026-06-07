import { afterEach, describe, expect, it, vi } from "vitest";
import { vibrate } from "./haptics";

afterEach(() => {
  // biome-ignore lint/suspicious/noExplicitAny: jsdom navigator has no vibrate
  delete (navigator as any).vibrate;
});

describe("vibrate", () => {
  it("forwards the pattern when the Vibration API exists", () => {
    const vibrateSpy = vi.fn();
    Object.defineProperty(navigator, "vibrate", {
      value: vibrateSpy,
      configurable: true,
      writable: true,
    });

    vibrate(10);
    vibrate([20, 10, 20]);

    expect(vibrateSpy).toHaveBeenNthCalledWith(1, 10);
    expect(vibrateSpy).toHaveBeenNthCalledWith(2, [20, 10, 20]);
  });

  it("no-ops without throwing when unsupported (e.g. iOS Safari)", () => {
    expect("vibrate" in navigator).toBe(false);
    expect(() => vibrate(10)).not.toThrow();
  });

  it("swallows a throwing implementation", () => {
    Object.defineProperty(navigator, "vibrate", {
      value: () => {
        throw new Error("blocked");
      },
      configurable: true,
      writable: true,
    });

    expect(() => vibrate()).not.toThrow();
  });

  it("stays silent for prefers-reduced-motion users", () => {
    const vibrateSpy = vi.fn();
    Object.defineProperty(navigator, "vibrate", {
      value: vibrateSpy,
      configurable: true,
      writable: true,
    });
    const matchMediaSpy = vi
      .spyOn(window, "matchMedia")
      .mockReturnValue({ matches: true } as MediaQueryList);

    vibrate(10);

    expect(matchMediaSpy).toHaveBeenCalledWith(
      "(prefers-reduced-motion: reduce)",
    );
    expect(vibrateSpy).not.toHaveBeenCalled();

    matchMediaSpy.mockRestore();
  });
});
