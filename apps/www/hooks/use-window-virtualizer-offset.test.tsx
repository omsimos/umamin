import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWindowVirtualizerOffset } from "./use-window-virtualizer-offset";

let rectTop = 100;

const makeRect = (top: number) =>
  ({
    top,
    bottom: 0,
    left: 0,
    right: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }) as DOMRect;

function Probe() {
  const { containerRef, scrollMargin } =
    useWindowVirtualizerOffset<HTMLDivElement>();
  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        if (el) {
          el.getBoundingClientRect = () => makeRect(rectTop);
        }
      }}
    >
      <span data-testid="margin">{scrollMargin}</span>
    </div>
  );
}

beforeEach(() => {
  rectTop = 100;
  document.body.style.position = "";
  // Run rAF synchronously so updateScrollMargin settles within act().
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.style.position = "";
});

describe("useWindowVirtualizerOffset", () => {
  it("computes the scroll margin from the element's document offset", () => {
    render(<Probe />);
    expect(screen.getByTestId("margin")).toHaveTextContent("100");
  });

  it("does not recompute while the body is scroll-locked (position:fixed)", () => {
    render(<Probe />);
    expect(screen.getByTestId("margin")).toHaveTextContent("100");

    // A Vaul drawer opening: <body> is pinned and the element's rect shifts.
    document.body.style.position = "fixed";
    rectTop = 40;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    // Keeps the pre-lock value instead of jumping the virtualized rows.
    expect(screen.getByTestId("margin")).toHaveTextContent("100");
  });

  it("recomputes once the lock is released", () => {
    render(<Probe />);

    document.body.style.position = "fixed";
    rectTop = 40;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(screen.getByTestId("margin")).toHaveTextContent("100");

    document.body.style.position = "";
    rectTop = 60;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(screen.getByTestId("margin")).toHaveTextContent("60");
  });
});
