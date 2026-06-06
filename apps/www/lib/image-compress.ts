import {
  AVATAR_EDGE,
  AVATAR_MAX_BYTES,
  AVATAR_TARGET_BYTES,
  MAX_AVATAR_SOURCE_BYTES,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_EDGE,
  MAX_POST_SOURCE_BYTES,
  TARGET_IMAGE_BYTES,
  type UploadContentType,
} from "@/lib/post-images";

export type CompressedImage = {
  blob: Blob;
  contentType: UploadContentType;
  width: number;
  height: number;
};

export class ImageCompressError extends Error {}

// Decoding a 100MP+ source would blow mobile memory budgets before we ever
// get to downscale it; anything this large isn't a photo we should accept.
const MAX_SOURCE_PIXELS = 80_000_000;

export type CompressPreset = {
  plan: ReadonlyArray<{ edge: number; quality: number }>;
  targetBytes: number;
  maxBytes: number;
  /** Cap on the picked file, checked before decode (createImageBitmap reads
   * the whole file, so this is the only guard that can fail fast). */
  maxSourceBytes: number;
  /** Center-crop to a square before scaling (profile photos). */
  square?: boolean;
};

// Walked in order until the encode lands under the byte target: crush quality
// at full display size first (dimension is more visible than quality at these
// sizes), then trade resolution. q < ~0.62 visibly bands, so dimensions drop
// instead. Exported for tests.
export const COMPRESSION_PLAN: ReadonlyArray<{
  edge: number;
  quality: number;
}> = [
  { edge: MAX_IMAGE_EDGE, quality: 0.72 },
  { edge: MAX_IMAGE_EDGE, quality: 0.62 },
  { edge: 640, quality: 0.62 },
];

const POST_PRESET: CompressPreset = {
  plan: COMPRESSION_PLAN,
  targetBytes: TARGET_IMAGE_BYTES,
  maxBytes: MAX_IMAGE_BYTES,
  maxSourceBytes: MAX_POST_SOURCE_BYTES,
};

const AVATAR_PRESET: CompressPreset = {
  plan: [
    { edge: AVATAR_EDGE, quality: 0.72 },
    { edge: AVATAR_EDGE, quality: 0.62 },
    { edge: 192, quality: 0.62 },
  ],
  targetBytes: AVATAR_TARGET_BYTES,
  maxBytes: AVATAR_MAX_BYTES,
  maxSourceBytes: MAX_AVATAR_SOURCE_BYTES,
  square: true,
};

// Fit (width, height) inside a square of `edge`, never upscaling.
export function fitWithin(width: number, height: number, edge: number) {
  const scale = Math.min(1, edge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Picks the first attempt under the byte target, else the smallest one that
 * still fits the hard cap. Pure — exported for tests.
 */
export function pickBestAttempt<T extends { size: number }>(
  attempts: T[],
  targetBytes = TARGET_IMAGE_BYTES,
  maxBytes = MAX_IMAGE_BYTES,
): T | null {
  const underTarget = attempts.find((a) => a.size <= targetBytes);
  if (underTarget) return underTarget;

  const smallest = [...attempts].sort((a, b) => a.size - b.size)[0];
  return smallest && smallest.size <= maxBytes ? smallest : null;
}

// Safari (all versions, 2026) silently encodes PNG when asked for WebP — the
// only reliable detection is encoding a pixel and checking the blob type.
let webpEncodeSupport: Promise<boolean> | null = null;

function supportsWebpEncode(): Promise<boolean> {
  webpEncodeSupport ??= (async () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const blob = await canvasToBlob(canvas, "image/webp", 0.8);
      return blob?.type === "image/webp";
    } catch {
      return false;
    }
  })();
  return webpEncodeSupport;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

function renderToCanvas(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  square: boolean,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new ImageCompressError("Couldn't process this image.");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (square) {
    // Center-crop the largest source square (cover semantics).
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = Math.floor((bitmap.width - side) / 2);
    const sy = Math.floor((bitmap.height - side) / 2);
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, width, height);
  } else {
    ctx.drawImage(bitmap, 0, 0, width, height);
  }

  return canvas;
}

/**
 * Aggressive lossy pipeline: decode (EXIF orientation applied), downscale to
 * the preset's largest edge, then walk its plan until the encode lands under
 * the byte target. WebP where the browser can encode it, JPEG on Safari.
 * Re-encoding also strips EXIF metadata (GPS etc.) as a side effect.
 */
export async function compressImage(
  file: File,
  preset: CompressPreset = POST_PRESET,
): Promise<CompressedImage> {
  if (file.type === "image/gif") {
    throw new ImageCompressError("GIFs aren't supported.");
  }

  if (file.size > preset.maxSourceBytes) {
    throw new ImageCompressError(
      `Choose an image under ${Math.round(preset.maxSourceBytes / (1024 * 1024))}MB.`,
    );
  }

  let bitmap: ImageBitmap;
  try {
    // Explicit "from-image": older Chromium ignored EXIF orientation by
    // default, which turned portrait phone photos sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageCompressError(
      "Couldn't read this image. Try a JPG, PNG, or WebP.",
    );
  }

  try {
    if (bitmap.width * bitmap.height > MAX_SOURCE_PIXELS) {
      throw new ImageCompressError("This image is too large.");
    }

    const contentType: UploadContentType = (await supportsWebpEncode())
      ? "image/webp"
      : "image/jpeg";

    const attempts: Array<{
      size: number;
      blob: Blob;
      width: number;
      height: number;
    }> = [];
    // Keyed by both dims: width alone can collide across plan steps for
    // degenerate aspect ratios and would silently reuse the wrong geometry.
    const canvases = new Map<string, HTMLCanvasElement>();

    for (const step of preset.plan) {
      const sourceWidth = preset.square
        ? Math.min(bitmap.width, bitmap.height)
        : bitmap.width;
      const sourceHeight = preset.square
        ? Math.min(bitmap.width, bitmap.height)
        : bitmap.height;
      const { width, height } = fitWithin(sourceWidth, sourceHeight, step.edge);

      let canvas = canvases.get(`${width}x${height}`);
      if (!canvas) {
        canvas = renderToCanvas(bitmap, width, height, preset.square === true);
        canvases.set(`${width}x${height}`, canvas);
      }

      // JPEG sits ~25-35% heavier than WebP at equal quality; nudge down to
      // keep Safari uploads near the same byte target.
      const quality =
        contentType === "image/jpeg" ? step.quality - 0.04 : step.quality;
      const blob = await canvasToBlob(canvas, contentType, quality);

      if (blob && blob.type === contentType) {
        attempts.push({ size: blob.size, blob, width, height });
        if (blob.size <= preset.targetBytes) break;
      }

      // Yield between encodes so a burst of attempts can't lock the main
      // thread through a whole frame budget.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const best = pickBestAttempt(attempts, preset.targetBytes, preset.maxBytes);

    if (!best) {
      throw new ImageCompressError("Couldn't compress this image enough.");
    }

    return {
      blob: best.blob,
      contentType,
      width: best.width,
      height: best.height,
    };
  } finally {
    bitmap.close();
  }
}

/** Profile photos: square center-crop at 256px, ~48KB target. */
export function compressAvatar(file: File) {
  return compressImage(file, AVATAR_PRESET);
}
