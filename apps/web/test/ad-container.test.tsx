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

beforeEach(() => {
  vi.stubEnv("PROD", true);
  vi.stubEnv("DEV", false);
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
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
    window.adsbygoogle = { push };
    const AdContainer = await loadAdContainer();
    const { container } = render(<AdContainer placement="feed_top" />);

    expect(container.querySelector("ins.adsbygoogle")).not.toBeNull();
    expect(push).toHaveBeenCalledTimes(1);
  });

  // A retry loop re-pushed every 250 ms after a throw, and each re-push made
  // AdSense throw "All 'ins' elements already have ads" again.
  it("does not re-push after a push throws", async () => {
    vi.useFakeTimers();
    const push = vi.fn(() => {
      throw new Error("adsbygoogle.push() error: All 'ins' elements ...");
    });
    window.adsbygoogle = { push };
    const AdContainer = await loadAdContainer();
    render(<AdContainer placement="feed_top" />);

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(push).toHaveBeenCalledTimes(1);
  });
});
