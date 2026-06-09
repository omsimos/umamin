import { describe, expect, it } from "vitest";
import {
  BANNER_PRESET,
  COMPRESSION_PLAN,
  fitWithin,
  pickBestAttempt,
} from "./image-compress";
import {
  BANNER_EDGE,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_EDGE,
  TARGET_IMAGE_BYTES,
} from "./post-images";

describe("fitWithin", () => {
  it("scales the long edge down to the bound, preserving aspect", () => {
    expect(fitWithin(4032, 3024, 2048)).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(3024, 4032, 2048)).toEqual({ width: 1536, height: 2048 });
  });

  it("never upscales", () => {
    expect(fitWithin(800, 600, 2048)).toEqual({ width: 800, height: 600 });
  });

  it("never collapses a dimension to zero", () => {
    expect(fitWithin(10000, 1, 1280).height).toBe(1);
  });
});

describe("COMPRESSION_PLAN", () => {
  it("starts at the max display edge and only walks downward", () => {
    expect(COMPRESSION_PLAN[0].edge).toBe(MAX_IMAGE_EDGE);

    for (let i = 1; i < COMPRESSION_PLAN.length; i++) {
      const prev = COMPRESSION_PLAN[i - 1];
      const step = COMPRESSION_PLAN[i];
      // Each step trades quality at the same size, or drops a size tier.
      expect(
        step.edge < prev.edge ||
          (step.edge === prev.edge && step.quality < prev.quality),
      ).toBe(true);
    }
  });

  it("keeps quality above the banding floor", () => {
    for (const step of COMPRESSION_PLAN) {
      expect(step.quality).toBeGreaterThanOrEqual(0.6);
      expect(step.quality).toBeLessThanOrEqual(0.72);
    }
  });
});

describe("BANNER_PRESET", () => {
  it("starts at the banner edge and only walks downward", () => {
    expect(BANNER_PRESET.plan[0].edge).toBe(BANNER_EDGE);

    for (let i = 1; i < BANNER_PRESET.plan.length; i++) {
      const prev = BANNER_PRESET.plan[i - 1];
      const step = BANNER_PRESET.plan[i];
      expect(
        step.edge < prev.edge ||
          (step.edge === prev.edge && step.quality < prev.quality),
      ).toBe(true);
    }
  });

  it("keeps quality above the banding floor and is not square-cropped", () => {
    for (const step of BANNER_PRESET.plan) {
      expect(step.quality).toBeGreaterThanOrEqual(0.6);
      expect(step.quality).toBeLessThanOrEqual(0.72);
    }
    // The user's manual crop supplies the aspect — no auto square center-crop.
    expect(BANNER_PRESET.square).toBeUndefined();
  });
});

describe("pickBestAttempt", () => {
  it("returns the first attempt under the byte target", () => {
    const attempts = [
      { size: TARGET_IMAGE_BYTES + 1, id: "a" },
      { size: TARGET_IMAGE_BYTES - 10, id: "b" },
      { size: 100, id: "c" },
    ];
    expect(pickBestAttempt(attempts)?.id).toBe("b");
  });

  it("falls back to the smallest attempt within the hard cap", () => {
    const attempts = [
      { size: MAX_IMAGE_BYTES - 1, id: "a" },
      { size: MAX_IMAGE_BYTES - 1000, id: "b" },
    ];
    expect(pickBestAttempt(attempts)?.id).toBe("b");
  });

  it("returns null when everything exceeds the hard cap", () => {
    expect(pickBestAttempt([{ size: MAX_IMAGE_BYTES + 1 }])).toBeNull();
    expect(pickBestAttempt([])).toBeNull();
  });

  it("honors custom budgets (avatar preset)", () => {
    const attempts = [
      { size: 60_000, id: "a" },
      { size: 40_000, id: "b" },
    ];
    expect(pickBestAttempt(attempts, 48 * 1024, 256 * 1024)?.id).toBe("b");
    expect(pickBestAttempt([{ size: 300_000 }], 48 * 1024, 256 * 1024)).toBe(
      null,
    );
  });
});
