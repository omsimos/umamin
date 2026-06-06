"use client";

import { Button } from "@umamin/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@umamin/ui/components/dialog";
import { cn } from "@umamin/ui/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { useRef } from "react";
import { publicImageUrl } from "@/lib/post-images";
import type { PostImageDisplay } from "@/types/post";

type Props = {
  images: PostImageDisplay[];
  index: number;
  onIndexChange: (index: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Full-screen media viewer: arrows/Esc on desktop, horizontal swipe to page
// + swipe-down to dismiss on touch, counter for multi-image posts.
export function ImageLightbox({
  images,
  index,
  onIndexChange,
  open,
  onOpenChange,
}: Props) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const image = images[index];

  const goTo = (next: number) => {
    if (next >= 0 && next < images.length) {
      onIndexChange(next);
    }
  };

  if (!image) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") goTo(index - 1);
          if (e.key === "ArrowRight") goTo(index + 1);
        }}
        onTouchStart={(e) => {
          touchStart.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
          };
        }}
        onTouchEnd={(e) => {
          const start = touchStart.current;
          touchStart.current = null;
          if (!start) return;

          const dx = e.changedTouches[0].clientX - start.x;
          const dy = e.changedTouches[0].clientY - start.y;

          if (Math.abs(dy) > 80 && Math.abs(dy) > Math.abs(dx)) {
            onOpenChange(false);
            return;
          }
          if (Math.abs(dx) > 48) {
            goTo(dx < 0 ? index + 1 : index - 1);
          }
        }}
        className="top-0 left-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0 bg-black/95 p-0 shadow-none"
      >
        <DialogTitle className="sr-only">Image viewer</DialogTitle>
        <DialogDescription className="sr-only">
          {`Image ${index + 1} of ${images.length}`}
        </DialogDescription>

        <div className="relative flex h-full w-full items-center justify-center">
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close image viewer"
              className="absolute top-3 left-3 z-10 rounded-full bg-black/60 text-white hover:bg-black/80 hover:text-white"
            >
              <XIcon />
            </Button>
          </DialogClose>

          {images.length > 1 && (
            <span
              aria-live="polite"
              className="absolute top-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white"
            >
              {index + 1} / {images.length}
            </span>
          )}

          {/* biome-ignore lint/performance/noImgElement: pre-optimized R2 asset; bypassing Vercel image optimization is deliberate */}
          <img
            src={image.previewUrl ?? publicImageUrl(image.key)}
            alt=""
            width={image.width}
            height={image.height}
            className="max-h-dvh max-w-full select-none object-contain"
            draggable={false}
          />

          {images.length > 1 && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Previous image"
                onClick={() => goTo(index - 1)}
                className={cn(
                  "absolute left-3 z-10 hidden rounded-full bg-black/60 text-white hover:bg-black/80 hover:text-white sm:inline-flex",
                  index === 0 && "invisible",
                )}
              >
                <ChevronLeftIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Next image"
                onClick={() => goTo(index + 1)}
                className={cn(
                  "absolute right-3 z-10 hidden rounded-full bg-black/60 text-white hover:bg-black/80 hover:text-white sm:inline-flex",
                  index === images.length - 1 && "invisible",
                )}
              >
                <ChevronRightIcon />
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
