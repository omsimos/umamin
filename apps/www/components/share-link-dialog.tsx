"use client";

import React from "react";
import { toast } from "sonner";
import { CopyIcon, LinkIcon } from "lucide-react";

import { Button } from "./ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Label } from "./ui/label";
import { Input } from "./ui/input";

const onCopy = (url: string) => {
  if (typeof window !== "undefined") {
    navigator.clipboard.writeText(url);
    toast.success("Copied to clipboard");
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
        <button type="button" title="Share Link">
          <LinkIcon className="h-6 w-6" />
        </button>
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
