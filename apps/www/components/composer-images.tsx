"use client";

import { Button } from "@umamin/ui/components/button";
import { cn } from "@umamin/ui/lib/utils";
import { Loader2Icon, RotateCcwIcon, XIcon } from "lucide-react";
import type { ImageAttachment } from "@/hooks/use-image-attachments";

type Props = {
  items: ImageAttachment[];
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
};

// Composer attachment tray: instant local previews with per-tile
// compress/upload state, remove, and retry.
export function ComposerImages({ items, onRemove, onRetry }: Props) {
  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        "grid gap-2",
        items.length === 1 ? "grid-cols-1" : "grid-cols-2",
      )}
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            "relative overflow-hidden rounded-xl border border-muted bg-muted",
            items.length === 1 ? "max-h-96" : "aspect-[7/8]",
          )}
        >
          {/* biome-ignore lint/performance/noImgElement: local object URL preview */}
          <img
            src={item.previewUrl}
            alt="Attachment preview"
            className={cn(
              "h-full w-full object-cover",
              items.length === 1 && "max-h-96 w-full object-contain",
            )}
          />

          {item.status === "processing" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Loader2Icon className="size-6 animate-spin text-white" />
              <span className="sr-only">Processing image</span>
            </div>
          )}

          {item.status === "uploading" && (
            <div
              role="progressbar"
              aria-label="Uploading image"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(item.progress * 100)}
              className="absolute inset-x-0 bottom-0 h-1 bg-black/40"
            >
              <div
                className="h-full bg-pink-500 transition-[width] duration-200"
                style={{ width: `${Math.round(item.progress * 100)}%` }}
              />
            </div>
          )}

          {item.status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 p-2 text-center">
              <p className="text-xs text-white">{item.error}</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onRetry(item.id)}
                className="h-7 rounded-full"
              >
                <RotateCcwIcon />
                Retry
              </Button>
            </div>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remove image"
            onClick={() => onRemove(item.id)}
            className="absolute top-1.5 right-1.5 size-7 rounded-full bg-black/60 text-white hover:bg-black/80 hover:text-white"
          >
            <XIcon />
          </Button>
        </div>
      ))}
    </div>
  );
}
