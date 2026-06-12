import { afterEach, describe, expect, it, vi } from "vitest";
import { isIOS, sharePng } from "./share";

const realUA = navigator.userAgent;
function setUserAgent(ua: string) {
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value: ua,
  });
}

const blob = new Blob(["png-bytes"], { type: "image/png" });

function stubShare(opts: {
  canShare?: boolean;
  shareImpl?: () => Promise<void>;
}) {
  Object.defineProperty(navigator, "canShare", {
    configurable: true,
    value: opts.canShare === undefined ? undefined : () => opts.canShare,
  });
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: opts.shareImpl,
  });
}

afterEach(() => {
  stubShare({});
  setUserAgent(realUA);
  vi.restoreAllMocks();
});

describe("isIOS", () => {
  it("is true for an iPhone UA and false for Android/desktop", () => {
    setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    );
    expect(isIOS()).toBe(true);
    setUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36");
    expect(isIOS()).toBe(false);
    setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    );
    expect(isIOS()).toBe(false);
  });
});

describe("sharePng", () => {
  it("uses the native share sheet when files are supported", async () => {
    const share = vi.fn(async () => {});
    stubShare({ canShare: true, shareImpl: share });
    await expect(sharePng(blob, "card.png")).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({ files: [expect.any(File)] });
  });

  it("treats a dismissed sheet as cancelled with no download", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click");
    stubShare({
      canShare: true,
      shareImpl: async () => {
        throw new DOMException("dismissed", "AbortError");
      },
    });
    await expect(sharePng(blob, "card.png")).resolves.toBe("cancelled");
    expect(click).not.toHaveBeenCalled();
  });

  it("falls back to a download when share is unavailable", async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    stubShare({});
    await expect(sharePng(blob, "card.png")).resolves.toBe("downloaded");
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("falls back to a download when the share call is not allowed", async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    stubShare({
      canShare: true,
      shareImpl: async () => {
        throw new DOMException("no gesture", "NotAllowedError");
      },
    });
    await expect(sharePng(blob, "card.png")).resolves.toBe("downloaded");
    expect(click).toHaveBeenCalledTimes(1);
  });
});
