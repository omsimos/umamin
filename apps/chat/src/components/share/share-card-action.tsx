import { Button } from "@umamin/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@umamin/ui/components/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@umamin/ui/components/drawer";
import { Download, Link2, Loader2, Share2 } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { rasterizeCardToPng } from "../../lib/share-card/rasterize";
import { downloadBlob, sharePng } from "../../lib/share-card/share";
import type { CardRender } from "../../lib/share-card/types";
import { useMediaQuery } from "../../lib/use-media-query";

interface GeneratedCard {
  /** The clean image — what Share/Save export. */
  blob: Blob;
  /** Preview object URL — may carry preview-only overlays (sticker guide). */
  url: string;
}

function PreviewBody({
  card,
  filename,
  copyUrl,
}: {
  card: GeneratedCard | null;
  filename: string;
  copyUrl?: string;
}) {
  if (!card) {
    return (
      <div className="flex aspect-9/16 max-h-[50vh] w-full items-center justify-center">
        <Loader2
          aria-label="Generating image"
          className="text-muted-foreground size-6 animate-spin"
        />
      </div>
    );
  }
  return (
    <>
      <img
        src={card.url}
        alt="Preview of your share card"
        className="mx-auto max-h-[50vh] rounded-xl border shadow-sm"
      />
      <div className="mt-4 flex justify-center gap-2">
        <Button
          className="rounded-full"
          onClick={() => {
            // The blob is pre-generated, so this runs synchronously inside
            // the tap — required for the share sheet on mobile.
            void sharePng(card.blob, filename).then((result) => {
              if (result === "downloaded") {
                toast("Saved — share it anywhere");
              }
            });
          }}
        >
          <Share2 />
          Share
        </Button>
        <Button
          variant="outline"
          className="rounded-full"
          aria-label="Download image"
          onClick={() => downloadBlob(card.blob, filename)}
        >
          <Download />
          Save
        </Button>
        {copyUrl && (
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => {
              navigator.clipboard.writeText(copyUrl);
              toast("Link copied — add it with a link sticker");
            }}
          >
            <Link2 />
            Copy link
          </Button>
        )}
      </div>
    </>
  );
}

export function ShareCardAction({
  label,
  title,
  description,
  filename,
  build,
  copyUrl,
  trigger,
}: {
  label: string;
  /** Sheet heading; defaults to the trigger label. */
  title?: string;
  /** Visible explainer under the heading (sr-only fallback when absent). */
  description?: string;
  filename: string;
  /** Builds the card to render — called once per open. */
  build: () => Promise<CardRender>;
  /** When set, adds a copy-link button — the link people add to the card's
   *  sticker placeholder (URLs painted on an image aren't tappable). */
  copyUrl?: string;
  /** Custom trigger; defaults to an outline button with the label. */
  trigger?: (open: () => void) => ReactNode;
}) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [open, setOpen] = useState(false);
  const [card, setCard] = useState<GeneratedCard | null>(null);
  // Ref'd so the generate effect keys on `open` alone — a new inline `build`
  // each parent render must not regenerate the image mid-preview.
  const buildRef = useRef(build);
  buildRef.current = build;

  useEffect(() => {
    if (!open) return;
    let alive = true;
    let url: string | null = null;
    (async () => {
      try {
        const { share, preview } = await rasterizeCardToPng(
          await buildRef.current(),
        );
        if (!alive) return;
        url = URL.createObjectURL(preview);
        setCard({ blob: share, url });
      } catch {
        if (!alive) return;
        toast("Couldn't generate the image — try again.");
        setOpen(false);
      }
    })();
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
      setCard(null);
    };
  }, [open]);

  const heading = title ?? label;
  const body = (
    <PreviewBody card={card} filename={filename} copyUrl={copyUrl} />
  );

  return (
    <>
      {trigger ? (
        trigger(() => setOpen(true))
      ) : (
        <Button
          variant="outline"
          className="rounded-full"
          onClick={() => setOpen(true)}
        >
          <Share2 />
          {label}
        </Button>
      )}
      {isDesktop ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{heading}</DialogTitle>
              <DialogDescription className={description ? "" : "sr-only"}>
                {description ?? "Preview and share a story-size image"}
              </DialogDescription>
            </DialogHeader>
            {body}
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{heading}</DrawerTitle>
              <DrawerDescription className={description ? "" : "sr-only"}>
                {description ?? "Preview and share a story-size image"}
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-6">{body}</div>
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
}
