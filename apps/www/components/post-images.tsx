"use client";

import { cn } from "@umamin/ui/lib/utils";
import { useState } from "react";
import { ImageLightbox } from "@/components/image-lightbox";
import { publicImageUrl } from "@/lib/post-images";
import type { PostImageDisplay } from "@/types/post";

type Props = {
  images: PostImageDisplay[];
  className?: string;
  /**
   * False inside an embedded quote card (which is itself a link): tiles render
   * as plain divs — no lightbox, no button-inside-anchor nesting.
   */
  interactive?: boolean;
};

// Clamp a lone image between slightly-tall and wide-cinema so one post can't
// monopolize the feed; in-range ratios render uncropped (object-cover only
// crops when the clamp engages). Multi-image grids use fixed-ratio tiles.
function singleImageRatio(width: number, height: number) {
  if (width <= 0 || height <= 0) return 1;
  return Math.min(Math.max(width / height, 0.8), 1.91);
}

/**
 * Feed media block: 1 = bounded natural ratio, 2 = side-by-side 7:8,
 * 3 = tall left + stacked right, 4 = 2x2. The wrapper reserves space via
 * aspect-ratio before any image loads (zero CLS), images are pre-compressed
 * WebP/JPEG served straight from the R2 custom domain (plain <img>, no
 * optimizer hop).
 */
export function PostImages({ images, className, interactive = true }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (images.length === 0) return null;

  const count = Math.min(images.length, 4);
  const shown = images.slice(0, 4);

  return (
    <>
      <div
        className={cn(
          // z-10 keeps tiles clickable above the post card's whole-card link.
          "relative z-10 mt-3 grid gap-0.5 overflow-hidden rounded-xl border border-muted",
          // A lone tall/square image is additionally height-capped so one
          // post can't fill the viewport in the feed; object-cover crops and
          // the lightbox shows the full image.
          count === 1 && "max-h-[50dvh]",
          count >= 2 && "grid-cols-2",
          count >= 3 && "grid-rows-2 aspect-[3/2]",
          className,
        )}
        style={
          count === 1
            ? {
                aspectRatio: String(
                  singleImageRatio(shown[0].width, shown[0].height),
                ),
              }
            : undefined
        }
      >
        {shown.map((image, i) => {
          const tileClassName = cn(
            "relative h-full w-full overflow-hidden bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
            count === 2 && "aspect-[7/8]",
            count === 3 && i === 0 && "row-span-2",
          );
          const img = (
            // biome-ignore lint/performance/noImgElement: pre-optimized R2 asset; bypassing Vercel image optimization is deliberate
            <img
              src={image.previewUrl ?? publicImageUrl(image.key)}
              alt=""
              width={image.width}
              height={image.height}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          );

          if (!interactive) {
            return (
              <div
                key={image.key || image.previewUrl}
                className={tileClassName}
              >
                {img}
              </div>
            );
          }

          return (
            <button
              key={image.key || image.previewUrl}
              type="button"
              onClick={() => setLightboxIndex(i)}
              aria-label={`View image ${i + 1} of ${count}`}
              className={tileClassName}
            >
              {img}
            </button>
          );
        })}
      </div>

      {interactive && lightboxIndex !== null && (
        <ImageLightbox
          images={shown}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          open
          onOpenChange={(open) => {
            if (!open) setLightboxIndex(null);
          }}
        />
      )}
    </>
  );
}
