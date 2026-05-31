"use client";

import { Button } from "@umamin/ui/components/button";
import { Share2Icon } from "lucide-react";
import { toast } from "sonner";

const onShare = (username: string) => {
  try {
    if (typeof window !== "undefined") {
      const url = `${window.location.origin}/user/${username}`;

      if (
        navigator.share &&
        navigator.canShare({ url }) &&
        process.env.NODE_ENV === "production"
      ) {
        navigator.share({ url });
      } else {
        navigator.clipboard.writeText(url);
        toast.success("Profile link copied.");
      }
    }
  } catch (err) {
    console.log(err);
  }
};

export function ShareButton({ username }: { username: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Share profile"
      onClick={() => onShare(username)}
    >
      <Share2Icon className="size-4 text-muted-foreground" />
    </Button>
  );
}
