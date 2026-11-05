import { render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const scriptSelector = 'script[src*="adsbygoogle.js"]';

let idleCallbacks: IdleRequestCallback[] = [];
let readyState: DocumentReadyState = "complete";

function runIdleCallbacks() {
  const pending = idleCallbacks;
  idleCallbacks = [];
  for (const cb of pending) cb({ didTimeout: false, timeRemaining: () => 50 });
}

beforeEach(() => {
  vi.stubEnv("PROD", true);
  vi.resetModules();
  idleCallbacks = [];
  readyState = "complete";
  window.requestIdleCallback = vi.fn((cb: IdleRequestCallback) => {
    idleCallbacks.push(cb);
    return idleCallbacks.length;
  });
  window.cancelIdleCallback = vi.fn();
  vi.spyOn(document, "readyState", "get").mockImplementation(() => readyState);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  for (const el of document.querySelectorAll(scriptSelector)) el.remove();
});

describe("AdsenseLoader", () => {
  // Loaded as a <head> script, AdSense raced hydration and its auto-placed
  // divs broke it (React #418). The loader must not exist in the SSR output.
  it("renders nothing on the server", async () => {
    const { AdsenseLoader } = await import("@/components/adsense-loader");
    expect(renderToString(<AdsenseLoader />)).toBe("");
  });

  // Auto ads must not run while route content below the shell is still
  // hydrating, so mounting alone is not enough.
  it("waits for the load event and an idle period", async () => {
    readyState = "loading";
    const { AdsenseLoader } = await import("@/components/adsense-loader");
    render(<AdsenseLoader />);

    runIdleCallbacks();
    expect(document.querySelector(scriptSelector)).toBeNull();

    window.dispatchEvent(new Event("load"));
    expect(document.querySelector(scriptSelector)).toBeNull();

    runIdleCallbacks();
    expect(document.querySelector(scriptSelector)).not.toBeNull();
    expect(window.requestIdleCallback).toHaveBeenCalledWith(
      expect.any(Function),
      { timeout: 3000 },
    );
  });

  it("requests the script once after idle, across remounts", async () => {
    const { AdsenseLoader } = await import("@/components/adsense-loader");
    render(<AdsenseLoader />);
    render(<AdsenseLoader />);
    expect(document.querySelector(scriptSelector)).toBeNull();

    runIdleCallbacks();
    const scripts =
      document.querySelectorAll<HTMLScriptElement>(scriptSelector);
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.async).toBe(true);
  });

  it("falls back to a timer without requestIdleCallback", async () => {
    vi.useFakeTimers();
    try {
      // biome-ignore lint/suspicious/noExplicitAny: removing a DOM API
      delete (window as any).requestIdleCallback;
      const { AdsenseLoader } = await import("@/components/adsense-loader");
      render(<AdsenseLoader />);
      expect(document.querySelector(scriptSelector)).toBeNull();

      vi.advanceTimersByTime(1000);
      expect(document.querySelector(scriptSelector)).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
