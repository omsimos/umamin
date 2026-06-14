"use client";

import { Button } from "@umamin/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@umamin/ui/components/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@umamin/ui/components/drawer";
import { Input } from "@umamin/ui/components/input";
import { cn } from "@umamin/ui/lib/utils";
import { CheckIcon, ClipboardPasteIcon, Music2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useMediaQuery } from "@/hooks/use-media-query";
import { parseSpotifyTrackId } from "@/lib/spotify";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The currently attached track URL (empty when none). */
  value: string;
  onAttach: (url: string) => void;
  onRemove: () => void;
};

export function NoteSongDrawer({
  open,
  onOpenChange,
  value,
  onAttach,
  onRemove,
}: Props) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // Draft lives here, not in SongForm, so it survives the Dialog<->Drawer swap
  // when the viewport crosses the breakpoint mid-edit (each primitive unmounts
  // its content, remounting SongForm). Re-seed from the committed value only as
  // the sheet opens.
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (open) {
      setDraft(value);
    }
  }, [open, value]);

  const form = (
    <SongForm
      draft={draft}
      setDraft={setDraft}
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
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="p-0">
          <DialogTitle className="sr-only">Add a song</DialogTitle>
          {form}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="grid place-items-center">
        <DrawerTitle className="sr-only">Add a song</DrawerTitle>
        {form}
      </DrawerContent>
    </Drawer>
  );
}

function SongForm({
  draft,
  setDraft,
  value,
  onAttach,
  onRemove,
  onCancel,
}: {
  draft: string;
  setDraft: (value: string) => void;
  value: string;
  onAttach: (url: string) => void;
  onRemove: () => void;
  onCancel: () => void;
}) {
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
    // Full-width so the bottom sheet spans the drawer (no centered side gaps);
    // the desktop Dialog constrains it via its own max-w-lg.
    <div className="w-full space-y-4 px-5 py-6 sm:px-6">
      <div className="space-y-1">
        <h2 className="font-semibold text-lg">Add a song</h2>
        <p className="text-muted-foreground text-sm">
          Paste a Spotify track link and it'll play right on your note.
        </p>
      </div>

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
