import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { adsEnabled } from "../../lib/ad-placements";
import { AdContainer } from "./ad-container";

vi.mock("../../lib/ad-placements", () => ({
  AD_CLIENT: "ca-pub-test",
  adPlacements: {
    lobby: { slotId: "123", minHeight: 280, lazy: false },
    ended: { slotId: "", minHeight: 280, lazy: false },
  },
  adsEnabled: vi.fn(() => false),
}));

const mockAdsEnabled = vi.mocked(adsEnabled);

afterEach(() => {
  mockAdsEnabled.mockReturnValue(false);
  // biome-ignore lint/suspicious/noExplicitAny: clean the google global between tests
  (window as any).adsbygoogle = undefined;
});

describe("AdContainer", () => {
  it("renders nothing for an unconfigured placement (empty slotId)", () => {
    const { container } = render(<AdContainer placement="ended" />);
    expect(container.querySelector("ins.adsbygoogle")).toBeNull();
    expect(screen.queryByText(/^ad:/)).toBeNull();
  });

  it("shows a dev placeholder when a slot is set but ads are disabled", () => {
    render(<AdContainer placement="lobby" />);
    expect(screen.getByText("ad: lobby")).toBeInTheDocument();
    expect(document.querySelector("ins.adsbygoogle")).toBeNull();
  });

  it("renders the ins and requests a fill exactly once when enabled", () => {
    mockAdsEnabled.mockReturnValue(true);
    const push = vi.fn();
    // biome-ignore lint/suspicious/noExplicitAny: google global
    (window as any).adsbygoogle = { push };
    const { container, rerender } = render(<AdContainer placement="lobby" />);
    expect(
      container.querySelector('ins.adsbygoogle[data-ad-slot="123"]'),
    ).not.toBeNull();
    expect(push).toHaveBeenCalledTimes(1);
    rerender(<AdContainer placement="lobby" />);
    expect(push).toHaveBeenCalledTimes(1);
  });
});
