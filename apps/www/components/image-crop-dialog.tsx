"use client";

import { Button } from "@umamin/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@umamin/ui/components/dialog";
import { cn } from "@umamin/ui/lib/utils";
import { Loader2Icon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { decodeOriented, ImageCompressError } from "@/lib/image-compress";
import {
  type CropArea,
  clampCenter,
  coverCrop,
  type Point,
} from "@/lib/image-crop";

// Preview canvas backing-store width; the element scales to its container via
// CSS while this stays fixed, so drag math is mapped through the rendered size.
const PREVIEW_WIDTH = 480;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.01;

type Props = {
  open: boolean;
  file: File | null;
  /** Crop frame aspect (width / height). 3 = banner, 1 = avatar. */
  aspect: number;
  /** Circular mask for avatars. */
  round?: boolean;
  title: string;
  maxSourceBytes: number;
  /** Parent is compressing/uploading the applied crop. */
  busy?: boolean;
  onApply: (crop: CropArea) => void;
  onCancel: () => void;
};

export function ImageCropDialog({
  open,
  file,
  aspect,
  round,
  title,
  maxSourceBytes,
  busy,
  onApply,
  onCancel,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<Point>({ x: 0, y: 0 });

  // Pointer-drag bookkeeping (refs so the listeners read live values).
  const dragging = useRef(false);
  const last = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Latest onCancel without making the decode effect re-run on its identity —
  // the parent recreates the handler every render, and re-running the decode
  // would close() the bitmap mid-life and leave the draw effect with a
  // detached source.
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  });

  // Decode the picked file (EXIF-oriented) into a bitmap the cropper draws
  // from. compressBanner/compressAvatar re-decode the same file in the same
  // orientation, so the crop rect maps 1:1 to the stored output. Deps are the
  // identity of the pick only — not churny callback props.
  useEffect(() => {
    if (!open || !file) return;

    let active = true;
    let decoded: ImageBitmap | null = null;

    decodeOriented(file, maxSourceBytes)
      .then((bmp) => {
        if (!active) {
          bmp.close();
          return;
        }
        decoded = bmp;
        setBitmap(bmp);
        setZoom(1);
        setCenter({ x: bmp.width / 2, y: bmp.height / 2 });
      })
      .catch((err) => {
        if (!active) return;
        toast.error(
          err instanceof ImageCompressError
            ? err.message
            : "Couldn't read this image.",
        );
        onCancelRef.current();
      });

    return () => {
      active = false;
      decoded?.close();
      setBitmap(null);
    };
  }, [open, file, maxSourceBytes]);

  // Stable per bitmap so the draw effect runs only when the framing changes,
  // not on every parent re-render.
  const natural = useMemo(
    () => (bitmap ? { width: bitmap.width, height: bitmap.height } : null),
    [bitmap],
  );

  // Redraw the WYSIWYG preview whenever the framing changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !bitmap || !natural) return;

    const crop = coverCrop(natural, aspect, zoom, center);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    try {
      ctx.drawImage(
        bitmap,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        canvas.width,
        canvas.height,
      );
    } catch {
      // The bitmap can be closed mid-teardown (dialog closing); the next valid
      // render redraws. Swallow the detached-source error rather than crash.
    }
  }, [bitmap, natural, aspect, zoom, center]);

  const pan = useCallback(
    (dxClient: number, dyClient: number) => {
      const canvas = canvasRef.current;
      if (!canvas || !natural) return;

      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      setCenter((prev) => {
        const crop = coverCrop(natural, aspect, zoom, prev);
        // Dragging the image right reveals content to its left, so the crop
        // window (and its center) moves the opposite way.
        const candidate = {
          x: prev.x - (dxClient * crop.width) / rect.width,
          y: prev.y - (dyClient * crop.height) / rect.height,
        };
        return clampCenter(
          candidate,
          { width: crop.width, height: crop.height },
          natural,
        );
      });
    },
    [natural, aspect, zoom],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (busy) return;
    dragging.current = true;
    last.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging.current) return;
    pan(e.clientX - last.current.x, e.clientY - last.current.y);
    last.current = { x: e.clientX, y: e.clientY };
  };

  const endDrag = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragging.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (busy) return;
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(1, z - e.deltaY * ZOOM_STEP)));
  };

  const apply = () => {
    if (!natural) return;
    onApply(coverCrop(natural, aspect, zoom, center));
  };

  const canvasHeight = Math.round(PREVIEW_WIDTH / aspect);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div
            className="relative mx-auto w-full overflow-hidden rounded-lg bg-black"
            style={{ aspectRatio: String(aspect) }}
          >
            {bitmap ? (
              <>
                <canvas
                  ref={canvasRef}
                  width={PREVIEW_WIDTH}
                  height={canvasHeight}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onWheel={onWheel}
                  className="h-full w-full touch-none cursor-grab active:cursor-grabbing"
                />
                {/* Crop mask: a huge spread shadow darkens everything outside
                    the framed shape (circle for avatars, rounded rect else). */}
                <div
                  className={cn(
                    "pointer-events-none absolute inset-0 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] ring-1 ring-white/60",
                    round ? "rounded-full" : "rounded-lg",
                  )}
                />
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Loader2Icon className="size-6 animate-spin text-white/70" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Zoom</span>
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              disabled={!bitmap || busy}
              onChange={(e) => setZoom(Number(e.target.value))}
              aria-label="Zoom"
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-foreground"
            />
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Drag to reposition
            {round ? "" : ", scroll or use the slider to zoom"}.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={!bitmap || busy} onClick={apply}>
            {busy && <Loader2Icon className="size-4 animate-spin" />}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
