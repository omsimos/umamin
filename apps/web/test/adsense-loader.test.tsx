import { render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const scriptSelector = 'script[src*="adsbygoogle.js"]';

beforeEach(() => {
  vi.stubEnv("PROD", true);
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  for (const el of document.querySelectorAll(scriptSelector)) el.remove();
});

describe("AdsenseLoader", () => {
  // Loaded as a <head> script, AdSense raced hydration and its auto-placed
  // divs broke it (React #418). The loader must not exist in the SSR output.
  it("renders nothing on the server", async () => {
    const { AdsenseLoader } = await import("@/components/adsense-loader");
    expect(renderToString(<AdsenseLoader />)).toBe("");
  });

  it("requests the script once after mount, across remounts", async () => {
    const { AdsenseLoader } = await import("@/components/adsense-loader");
    render(<AdsenseLoader />);
    render(<AdsenseLoader />);

    const scripts =
      document.querySelectorAll<HTMLScriptElement>(scriptSelector);
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.async).toBe(true);
  });
});
