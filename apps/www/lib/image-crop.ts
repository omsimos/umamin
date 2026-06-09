// Pure crop geometry (no DOM) shared by the crop dialog's live preview and the
// final compress pass — keeping it side-effect-free makes the math unit-testable
// and guarantees the preview rect and the stored rect are computed identically.

export type CropArea = { x: number; y: number; width: number; height: number };
export type Size = { width: number; height: number };
export type Point = { x: number; y: number };

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// Largest rect of the given aspect (width / height) that fits inside `natural`
// — the crop region at zoom 1 (the frame fully covered, nothing cropped away
// beyond what the aspect demands).
export function baseCoverSize(natural: Size, aspect: number): Size {
  const width = Math.min(natural.width, natural.height * aspect);
  return { width, height: width / aspect };
}

// Keep a `crop`-sized rect centered at `center` fully inside `natural`. Since a
// cover crop is never larger than the image on either axis, the clamp bounds
// are always valid (min <= max).
export function clampCenter(center: Point, crop: Size, natural: Size): Point {
  return {
    x: clamp(center.x, crop.width / 2, natural.width - crop.width / 2),
    y: clamp(center.y, crop.height / 2, natural.height - crop.height / 2),
  };
}

/**
 * The crop rectangle (natural px) for a cover-fit frame of `aspect`, zoomed by
 * `zoom` (>= 1, zooming in shrinks the rect) around `center`. The center is
 * clamped so the rect never leaves the image — the frame always stays covered.
 */
export function coverCrop(
  natural: Size,
  aspect: number,
  zoom: number,
  center: Point,
): CropArea {
  const base = baseCoverSize(natural, aspect);
  const z = Math.max(1, zoom);
  const width = base.width / z;
  const height = base.height / z;
  const c = clampCenter(center, { width, height }, natural);
  return { x: c.x - width / 2, y: c.y - height / 2, width, height };
}
