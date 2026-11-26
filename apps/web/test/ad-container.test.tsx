// @vitest-environment-options {"url":"https://www.umamin.link/feed"}
import { act, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Production rendering of a slot: the dev placeholder is off and the push runs,
// which the jsdom default host (localhost) would skip.

vi.mock("@/lib/posthog", () => ({ captureException: vi.fn() }));

async function loadAdContainer() {
  const mod = await import("@/components/ad-container");
  return mod.default;
}

// What adsbygoogle.js does when it runs: swaps the window.adsbygoogle queue
// for a live object with `loaded: true`, then drains what was queued.
function liveAdsense(push: (slot: object) => void) {
  const queued: object[] = Array.isArray(window.adsbygoogle)
    ? window.adsbygoogle
    : [];
  window.adsbygoogle = { push, loaded: true };
  for (const slot of queued) push(slot);
}

beforeEach(() => {
  vi.stubEnv("PROD", true);
  vi.stubEnv("DEV", false);
  vi.resetModules();
  // jsdom has no layout, so every box would read as zero width.
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(360);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  // oxlint-disable-next-line typescript/no-explicit-any -- google global
  delete (window as any).adsbygoogle;
});

describe("AdContainer in production", () => {
  it("reserves the slot height in server HTML without the <ins>", async () => {
    const AdContainer = await loadAdContainer();
    const html = renderToString(<AdContainer placement="feed_top" />);

    expect(html).toContain("min-height:280px");
    expect(html).not.toContain("adsbygoogle");
  });

  it("mounts the <ins> in the browser and pushes it once", async () => {
    const push = vi.fn();
    liveAdsense(push);
    const AdContainer = await loadAdContainer();
    const { container } = render(<AdContainer placement="feed_top" />);

    expect(container.querySelector("ins.adsbygoogle")).not.toBeNull();
    expect(push).toHaveBeenCalledTimes(1);
  });

  // A slot in a box that is hidden or not laid out yet has no width, and
  // AdSense throws "No slot size for availableWidth=0" for it.
  it("waits for the slot to have a width before pushing", async () => {
    let width = 0;
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
      () => width,
    );
    let resize: ResizeObserverCallback = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          resize = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    const push = vi.fn();
    liveAdsense(push);
    const AdContainer = await loadAdContainer();
    render(<AdContainer placement="feed_top" />);

    expect(push).not.toHaveBeenCalled();

    width = 360;
    act(() => resize([], {} as ResizeObserver));
    expect(push).toHaveBeenCalledTimes(1);
  });

  // A retry loop re-pushed every 250 ms after a throw, and each re-push made
  // AdSense throw "All 'ins' elements already have ads" again.
  it("does not re-push after a push throws", async () => {
    vi.useFakeTimers();
    const push = vi.fn(() => {
      throw new Error("adsbygoogle.push() error: All 'ins' elements ...");
    });
    liveAdsense(push);
    const AdContainer = await loadAdContainer();
    render(<AdContainer placement="feed_top" />);

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(push).toHaveBeenCalledTimes(1);
  });

  // In-feed units sit below the first screen. Filled on render, most were
  // never seen, and the low viewability lowered what advertisers bid on every
  // unit. A fling through a list also outruns a short lead, so they start
  // loading 1.5 screens ahead.
  it.each(["feed_inline", "notes_inline"] as const)(
    "waits to fill %s until it is 1.5 screens from the viewport",
    async (placement) => {
      let reveal: IntersectionObserverCallback = () => {};
      let options: IntersectionObserverInit | undefined;
      const observed: Element[] = [];
      vi.stubGlobal(
        "IntersectionObserver",
        class {
          constructor(
            callback: IntersectionObserverCallback,
            init?: IntersectionObserverInit,
          ) {
            reveal = callback;
            options = init;
          }
          observe(target: Element) {
            observed.push(target);
          }
          disconnect() {}
        },
      );
      const push = vi.fn();
      liveAdsense(push);
      const AdContainer = await loadAdContainer();
      const { container } = render(<AdContainer placement={placement} />);

      expect(observed).toEqual([container.firstElementChild]);
      expect(options?.rootMargin).toBe("150% 0px");
      expect(container.querySelector("ins.adsbygoogle")).toBeNull();
      expect(push).not.toHaveBeenCalled();

      act(() => {
        reveal(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        );
      });

      expect(container.querySelector("ins.adsbygoogle")).not.toBeNull();
      expect(push).toHaveBeenCalledTimes(1);
    },
  );
});

// The script loads only once the page is idle, and slots mount before that.
// A push queued for a slot that is gone by then (a navigation, a re-render)
// makes AdSense throw "All 'ins' elements in the DOM with class=adsbygoogle
// already have ads in them" when it drains the queue.
describe("AdContainer before AdSense loads", () => {
  beforeEach(() => {
    window.requestIdleCallback = vi.fn((cb: IdleRequestCallback) => {
      cb({ didTimeout: false, timeRemaining: () => 50 });
      return 1;
    });
    window.cancelIdleCallback = vi.fn();
    vi.spyOn(document, "readyState", "get").mockReturnValue("complete");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const el of document.querySelectorAll('script[src*="adsbygoogle.js"]'))
      el.remove();
  });

  async function renderWithLoader() {
    const AdContainer = await loadAdContainer();
    const { AdsenseLoader } = await import("@/components/adsense-loader");
    const view = render(
      <>
        <AdsenseLoader />
        <AdContainer placement="feed_top" />
      </>,
    );
    const script = document.querySelector<HTMLScriptElement>(
      'script[src*="adsbygoogle.js"]',
    );
    if (!script) throw new Error("AdSense script was not injected");
    const load = (push: (slot: object) => void) =>
      act(() => {
        liveAdsense(push);
        script.dispatchEvent(new Event("load"));
      });
    return { ...view, load };
  }

  it("queues nothing until the script has loaded", async () => {
    await renderWithLoader();
    expect(window.adsbygoogle ?? []).toHaveLength(0);
  });

  it("pushes a mounted slot once the script loads", async () => {
    const { load } = await renderWithLoader();
    const push = vi.fn();
    load(push);
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("drops the push for a slot removed before the script loads", async () => {
    const { load, rerender } = await renderWithLoader();
    const { AdsenseLoader } = await import("@/components/adsense-loader");
    rerender(<AdsenseLoader />);
    const push = vi.fn();
    load(push);
    expect(push).not.toHaveBeenCalled();
  });

  it("skips a slot AdSense filled before the push ran", async () => {
    const { container, load } = await renderWithLoader();
    container
      .querySelector("ins.adsbygoogle")
      ?.setAttribute("data-adsbygoogle-status", "done");
    const push = vi.fn();
    load(push);
    expect(push).not.toHaveBeenCalled();
  });
});
