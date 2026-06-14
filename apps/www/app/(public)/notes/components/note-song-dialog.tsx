"use client";

import { Button } from "@umamin/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@umamin/ui/components/dialog";
import { Input } from "@umamin/ui/components/input";
import { cn } from "@umamin/ui/lib/utils";
import { CheckIcon, ClipboardPasteIcon, Music2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { parseSpotifyTrackId } from "@/lib/spotify";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The currently attached track URL (empty when none). */
  value: string;
  onAttach: (url: string) => void;
  onRemove: () => void;
};

// A centered Dialog (not a bottom Drawer): the soft keyboard pushes a bottom
// sheet around and breaks its layout, whereas a Dialog stays put and the
// browser scrolls the focused input into view.
export function NoteSongDialog({
  open,
  onOpenChange,
  value,
  onAttach,
  onRemove,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a song</DialogTitle>
          <DialogDescription>
            Paste a Spotify track link and it'll play right on your note.
          </DialogDescription>
        </DialogHeader>

        {/* Radix unmounts content on close, so SongForm remounts each open and
            re-seeds its draft from `value`. */}
        <SongForm
          value={value}
          onAttach={(url) => {
            onAttach(url);
            onOpenChange(false);
          }}
          onRemove={() => {
            onRemove();
            onOpenChange(false);
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function SongForm({
  value,
  onAttach,
  onRemove,
  onCancel,
}: {
  value: string;
  onAttach: (url: string) => void;
  onRemove: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);

  const trimmed = draft.trim();
  const trackId = trimmed ? parseSpotifyTrackId(trimmed) : null;
  const invalid = trimmed.length > 0 && !trackId;

  const handlePaste = async () => {
    // Unavailable on insecure contexts / older browsers — tell the user rather
    // than silently no-op so they fall back to a manual paste.
    if (!navigator.clipboard?.readText) {
      toast.error("Your browser blocks clipboard access — paste manually.");
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setDraft(text.trim());
      }
    } catch {
      toast.error("Couldn't read your clipboard — paste the link manually.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Music2Icon
            className={cn(
              "-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 transition-colors",
              invalid
                ? "text-destructive"
                : trackId
                  ? "text-emerald-500"
                  : "text-muted-foreground",
            )}
          />
          <Input
            type="url"
            inputMode="url"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste a Spotify song link"
            aria-invalid={invalid}
            className="pl-9 text-sm"
          />
        </div>
        <Button type="button" variant="outline" onClick={handlePaste}>
          <ClipboardPasteIcon />
          Paste
        </Button>
      </div>

      {invalid ? (
        <p className="text-destructive text-xs">
          That doesn't look like a Spotify track link.
        </p>
      ) : trackId ? (
        <p className="flex items-center gap-1 text-emerald-500 text-xs">
          <CheckIcon className="size-3" /> Looks good
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          In Spotify: a track's Share menu &rarr; Copy link.
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        {value && (
          <Button
            type="button"
            variant="ghost"
            onClick={onRemove}
            className="mr-auto text-destructive hover:text-destructive"
          >
            Remove
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={!trackId}
          onClick={() => trackId && onAttach(trimmed)}
        >
          Attach song
        </Button>
      </div>
    </div>
  );
}
