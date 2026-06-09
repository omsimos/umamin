import { describe, expect, it } from "vitest";
import { baseCoverSize, clamp, clampCenter, coverCrop } from "./image-crop";

describe("baseCoverSize", () => {
  it("is width-bound on a square image for a wide frame", () => {
    // 3:1 frame, 400x400 image: height*3 (1200) > 400, so width caps at 400.
    expect(baseCoverSize({ width: 400, height: 400 }, 3)).toEqual({
      width: 400,
      height: 400 / 3,
    });
  });

  it("is height-bound on a tall image", () => {
    // 300x900, 3:1: min(300, 900*3) = 300 -> 300x100.
    expect(baseCoverSize({ width: 300, height: 900 }, 3)).toEqual({
      width: 300,
      height: 100,
    });
  });

  it("returns the full square for a 1:1 frame on a square image", () => {
    expect(baseCoverSize({ width: 500, height: 500 }, 1)).toEqual({
      width: 500,
      height: 500,
    });
  });
});

describe("coverCrop", () => {
  const natural = { width: 1200, height: 600 };

  it("at zoom 1 yields the largest aspect rect, centered", () => {
    const crop = coverCrop(natural, 3, 1, { x: 600, y: 300 });
    expect(crop.width).toBe(1200);
    expect(crop.height).toBe(400);
    expect(crop.x).toBe(0);
    expect(crop.y).toBe(100); // (600 - 400) / 2
  });

  it("zooming in shrinks the rect proportionally", () => {
    const z1 = coverCrop(natural, 3, 1, { x: 600, y: 300 });
    const z2 = coverCrop(natural, 3, 2, { x: 600, y: 300 });
    expect(z2.width).toBe(z1.width / 2);
    expect(z2.height).toBe(z1.height / 2);
  });

  it("clamps the center so the rect never leaves the image", () => {
    const topLeft = coverCrop(natural, 3, 2, { x: -9999, y: -9999 });
    expect(topLeft.x).toBe(0);
    expect(topLeft.y).toBe(0);

    const bottomRight = coverCrop(natural, 3, 2, { x: 9999, y: 9999 });
    expect(bottomRight.x + bottomRight.width).toBe(natural.width);
    expect(bottomRight.y + bottomRight.height).toBe(natural.height);
  });

  it("treats zoom < 1 as the cover floor (no upscaling)", () => {
    const z1 = coverCrop(natural, 3, 1, { x: 600, y: 300 });
    const zHalf = coverCrop(natural, 3, 0.5, { x: 600, y: 300 });
    expect(zHalf).toEqual(z1);
  });
});

describe("clamp / clampCenter", () => {
  it("clamps a scalar to the range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it("keeps a crop-sized rect's center inside the image bounds", () => {
    expect(
      clampCenter(
        { x: 0, y: 0 },
        { width: 100, height: 100 },
        { width: 1000, height: 1000 },
      ),
    ).toEqual({ x: 50, y: 50 });
  });
});
