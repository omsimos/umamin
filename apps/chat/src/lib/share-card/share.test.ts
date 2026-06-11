import { afterEach, describe, expect, it, vi } from "vitest";
import { sharePng } from "./share";

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
  vi.restoreAllMocks();
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
