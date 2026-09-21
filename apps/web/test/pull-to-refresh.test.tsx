import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PULL_THRESHOLD, PullToRefresh } from "@/components/pull-to-refresh";

// jsdom has no Touch constructor, so the touch list is stapled onto a plain
// Event; the component only reads clientX/clientY off touches[0].
function touch(
  el: Element,
  type: "touchstart" | "touchmove" | "touchend",
  points: Array<{ x?: number; y: number }> = [],
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", {
    value: points.map((p) => ({ clientX: p.x ?? 0, clientY: p.y })),
  });
  act(() => {
    el.dispatchEvent(event);
  });
  return event;
}

// Finger travel that lands past the threshold after the component's damping.
const ARMING_TRAVEL = PULL_THRESHOLD * 3;

function setStandalone(matches: boolean) {
  window.matchMedia = (query: string) =>
    ({
      matches: matches && query === "(display-mode: standalone)",
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

const originalMatchMedia = window.matchMedia;

function setup(onRefresh = vi.fn(async () => {})) {
  render(
    <PullToRefresh onRefresh={onRefresh}>
      <p>list</p>
    </PullToRefresh>,
  );
  const root = screen.getByText("list").parentElement
    ?.parentElement as HTMLElement;
  return { root, onRefresh };
}

beforeEach(() => {
  setStandalone(true);
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe("PullToRefresh", () => {
  it("refreshes after a pull past the threshold and announces it", async () => {
    let finish!: () => void;
    const onRefresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { root } = setup(onRefresh);

    touch(root, "touchstart", [{ y: 100 }]);
    touch(root, "touchmove", [{ y: 100 + ARMING_TRAVEL }]);
    touch(root, "touchend");

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("Refreshing");

    await act(async () => {
      finish();
    });
    await waitFor(() =>
      expect(screen.queryByRole("status")).not.toBeInTheDocument(),
    );
  });

  it("does nothing for a short pull", () => {
    const { root, onRefresh } = setup();
    touch(root, "touchstart", [{ y: 100 }]);
    touch(root, "touchmove", [{ y: 100 + PULL_THRESHOLD / 2 }]);
    touch(root, "touchend");
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("ignores a drag that starts while scrolled down", () => {
    Object.defineProperty(window, "scrollY", { value: 80, configurable: true });
    const { root, onRefresh } = setup();
    touch(root, "touchstart", [{ y: 100 }]);
    const move = touch(root, "touchmove", [{ y: 100 + ARMING_TRAVEL }]);
    touch(root, "touchend");
    expect(onRefresh).not.toHaveBeenCalled();
    // The scroll itself must not have been swallowed.
    expect(move.defaultPrevented).toBe(false);
  });

  it("lets a sideways swipe through to carousels", () => {
    const { root, onRefresh } = setup();
    touch(root, "touchstart", [{ x: 0, y: 100 }]);
    const move = touch(root, "touchmove", [{ x: 120, y: 100 + 40 }]);
    touch(root, "touchend");
    expect(move.defaultPrevented).toBe(false);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("stays inert in a browser tab", () => {
    setStandalone(false);
    const { root, onRefresh } = setup();
    touch(root, "touchstart", [{ y: 100 }]);
    touch(root, "touchmove", [{ y: 100 + ARMING_TRAVEL }]);
    touch(root, "touchend");
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("does not start a second refresh while one is running", () => {
    const onRefresh = vi.fn(() => new Promise<void>(() => {}));
    const { root } = setup(onRefresh);
    for (let i = 0; i < 2; i++) {
      touch(root, "touchstart", [{ y: 100 }]);
      touch(root, "touchmove", [{ y: 100 + ARMING_TRAVEL }]);
      touch(root, "touchend");
    }
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
