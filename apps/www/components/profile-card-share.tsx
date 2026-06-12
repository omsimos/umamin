"use client";

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
import { DownloadIcon, Link2Icon, Loader2Icon, Share2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  type ProfileCardUser,
  renderProfileCard,
} from "@/lib/share-card/profile-card";
import { downloadBlob, isIOS, sharePng } from "@/lib/share-card/share";

interface GeneratedCard {
  /** The clean image — what Share/Save export. */
  blob: Blob;
  /** Preview object URL — carries the preview-only sticker guide. */
  url: string;
}

const TITLE = "Your profile card";
const DESCRIPTION =
  "Post it to your story, then copy your link and add it with a link " +
  "sticker where the dashed guide shows. The guide is only in this preview " +
  "— the shared image keeps that spot clean.";

function PreviewBody({
  card,
  filename,
  username,
}: {
  card: GeneratedCard | null;
  filename: string;
  username: string;
}) {
  if (!card) {
    return (
      <div className="flex aspect-9/16 max-h-[50vh] w-full items-center justify-center">
        <Loader2Icon
          aria-label="Generating image"
          className="text-muted-foreground size-6 animate-spin"
        />
      </div>
    );
  }
  return (
    <>
      {/* biome-ignore lint/performance/noImgElement: locally generated blob preview */}
      <img
        src={card.url}
        alt="Preview of your profile card"
        className="mx-auto max-h-[50vh] rounded-xl border shadow-sm"
      />
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button
          className="rounded-full"
          onClick={() => {
            void sharePng(card.blob, filename).then((result) => {
              if (result === "downloaded") {
                toast.success("Saved — share it anywhere.");
              }
            });
          }}
        >
          <Share2Icon />
          Share
        </Button>
        {/* iOS's native Share already saves to Photos — an explicit download
            there only lands in Files, so hide it. Android/desktop keep it. */}
        {!isIOS() && (
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => downloadBlob(card.blob, filename)}
          >
            <DownloadIcon />
            Save
          </Button>
        )}
        <Button
          variant="outline"
          className="rounded-full"
          onClick={() => {
            navigator.clipboard.writeText(
              `${window.location.origin}/to/${username}`,
            );
            toast.success("Link copied — add it with a link sticker.");
          }}
        >
          <Link2Icon />
          Copy link
        </Button>
      </div>
    </>
  );
}

export function ProfileCardShare({
  user,
  open,
  onOpenChange,
}: {
  user: ProfileCardUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Same breakpoint as the other profile drawers (FollowListDrawer).
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [card, setCard] = useState<GeneratedCard | null>(null);
  const filename = `umamin-${user.username}.png`;

  // Pre-generate on open so the Share tap calls navigator.share synchronously
  // (the mobile share sheet requires an intact user gesture).
  // biome-ignore lint/correctness/useExhaustiveDependencies: generate once per open
  useEffect(() => {
    if (!open) return;
    let alive = true;
    let url: string | null = null;
    (async () => {
      try {
        const { share, preview } = await renderProfileCard(user);
        if (!alive) return;
        url = URL.createObjectURL(preview);
        setCard({ blob: share, url });
      } catch {
        if (!alive) return;
        toast.error("Couldn't generate the image — try again.");
        onOpenChange(false);
      }
    })();
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
      setCard(null);
    };
  }, [open]);

  const body = (
    <PreviewBody card={card} filename={filename} username={user.username} />
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{TITLE}</DialogTitle>
            <DialogDescription>{DESCRIPTION}</DialogDescription>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{TITLE}</DrawerTitle>
          <DrawerDescription>{DESCRIPTION}</DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-6">{body}</div>
      </DrawerContent>
    </Drawer>
  );
}
