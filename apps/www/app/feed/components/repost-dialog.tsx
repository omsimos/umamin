"use client";

import { Button } from "@umamin/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@umamin/ui/components/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@umamin/ui/components/drawer";
import { Textarea } from "@umamin/ui/components/textarea";
import { cn } from "@umamin/ui/lib/utils";
import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";

type RepostDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAuthenticated: boolean;
  isReposted: boolean;
  onQuote: (content: string) => Promise<void>;
};

export function RepostDialog({
  open,
  onOpenChange,
  isAuthenticated,
  isReposted,
  onQuote,
}: RepostDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    onOpenChange(false);
    setContent("");
  };

  const handleQuote = async () => {
    if (!isAuthenticated || isReposted) return;
    const trimmed = content.trim();
    if (!trimmed) return;
    setIsSubmitting(true);
    try {
      await onQuote(trimmed);
      handleClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const body = (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          {isReposted
            ? "You’ve already reposted this."
            : "Add a caption to share alongside the post."}
        </p>
      </div>

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={500}
        placeholder="Add a comment (optional)"
        className={cn(
          "focus-visible:ring-transparent text-sm resize-none min-h-24 bg-muted/50",
          isReposted && "opacity-60 pointer-events-none",
        )}
      />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{content.length}/500</span>
      </div>
    </div>
  );

  const actions = (
    <DialogFooter className="mt-4">
      <Button
        type="button"
        variant="secondary"
        onClick={handleClose}
        disabled={isSubmitting}
      >
        Cancel
      </Button>
      <Button
        type="button"
        onClick={handleQuote}
        disabled={
          isSubmitting ||
          !isAuthenticated ||
          isReposted ||
          content.trim().length === 0
        }
      >
        {isSubmitting ? (
          <Loader2Icon className="h-4 w-4 animate-spin" />
        ) : (
          "Quote repost"
        )}
      </Button>
    </DialogFooter>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Repost</DialogTitle>
            <DialogDescription className="sr-only">
              Repost with or without a quote.
            </DialogDescription>
          </DialogHeader>
          {body}
          {actions}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="p-4">
        <DrawerHeader>
          <DrawerTitle>Repost</DrawerTitle>
        </DrawerHeader>
        {body}
        {actions}
      </DrawerContent>
    </Drawer>
  );
}
