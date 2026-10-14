import type { CardRender, TextOp } from "./types";

export interface RasterizedCard {
  /** The clean image people share/save. */
  share: Blob;
  /** Same image plus preview-only overlays (the link-sticker guide). */
  preview: Blob;
}

/**
 * SVG (art) → canvas, then the text ops via fillText. Text is drawn on the
 * canvas — not in the SVG — because an SVG loaded as an image renders in a
 * sandbox that can't see the document's loaded fonts. Everything in the SVG
 * is inline data (data: URIs), so the canvas never taints.
 *
 * Exports twice from one pass: the clean share image first, then the
 * preview-only overlay is drawn on top and exported as the preview.
 */
export async function rasterizeCardToPng(
  card: CardRender,
): Promise<RasterizedCard> {
  // Warm the exact faces fillText will use; the page self-hosts them, so this
  // resolves instantly in practice. Failures fall back to system fonts.
  const fonts = [...card.texts, ...(card.previewTexts ?? [])].map(
    (t) => t.font,
  );
  if (typeof document.fonts?.load === "function") {
    await Promise.all(
      [...new Set(fonts)].map((f) =>
        document.fonts.load(f, "Mg1").catch(() => {}),
      ),
    );
  }

  const canvas = document.createElement("canvas");
  canvas.width = card.width;
  canvas.height = card.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unavailable");

  async function drawSvg(svg: string) {
    if (!ctx) return;
    // blob: URL (same-origin, never taints) over re-encoding the SVG as data:.
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    try {
      const img = new Image();
      img.src = url;
      // decode() waits for the full SVG — including its nested data: avatars.
      await img.decode();
      ctx.drawImage(img, 0, 0, card.width, card.height);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function drawTexts(texts: TextOp[]) {
    if (!ctx) return;
    for (const t of texts) {
      ctx.font = t.font;
      ctx.fillStyle = t.fill;
      ctx.textAlign = t.align ?? "left";
      ctx.textBaseline = "alphabetic";
      if ("letterSpacing" in ctx) {
        ctx.letterSpacing = t.letterSpacing ?? "0px";
      }
      if (t.maxWidth) {
        ctx.fillText(t.text, t.x, t.y, t.maxWidth);
      } else {
        ctx.fillText(t.text, t.x, t.y);
      }
    }
  }

  function toPng(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("png-encode-failed"))),
        "image/png",
      );
    });
  }

  await drawSvg(card.svg);
  drawTexts(card.texts);
  const share = await toPng();

  if (!card.previewSvg && !card.previewTexts?.length) {
    return { share, preview: share };
  }
  if (card.previewSvg) await drawSvg(card.previewSvg);
  drawTexts(card.previewTexts ?? []);
  const preview = await toPng();
  return { share, preview };
}
