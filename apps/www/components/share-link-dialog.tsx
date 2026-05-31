"use client";

import { Button } from "@umamin/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@umamin/ui/components/dialog";
import { Input } from "@umamin/ui/components/input";
import { Label } from "@umamin/ui/components/label";
import { CopyIcon, LinkIcon } from "lucide-react";
import { toast } from "sonner";

const onCopy = (url: string) => {
  if (typeof window !== "undefined") {
    navigator.clipboard.writeText(url);
    toast.success("Copied.");
  }
};

export function ShareLinkDialog({ username }: { username: string }) {
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/to/${username}`
      : "";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label="Share link"
          title="Share link"
          // Matches the sibling menu-bar items (full-width, py-5, rounded-lg,
          // muted hover) while overriding Button's default size/padding/hover.
          className="h-auto w-full justify-center rounded-lg px-0 py-5 hover:bg-muted text-muted-foreground"
        >
          <LinkIcon className="size-6" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share link</DialogTitle>
          <DialogDescription>
            Get anonymous messages using this link.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-2">
          <div className="grid flex-1 gap-2">
            <Label htmlFor="link" className="sr-only">
              Link
            </Label>
            <Input id="link" defaultValue={url} readOnly />
          </div>
          <Button onClick={() => onCopy(url)} size="sm" className="px-3">
            <span className="sr-only">Copy</span>
            <CopyIcon className="h-4 w-4" />
          </Button>
        </div>
        <DialogFooter className="sm:justify-start">
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
