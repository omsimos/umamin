"use client";

import { Button } from "@umamin/ui/components/button";
import { Share2Icon } from "lucide-react";
import type { ComponentProps } from "react";
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

export function ShareButton({
  username,
  variant = "ghost",
  className,
}: {
  username: string;
  variant?: ComponentProps<typeof Button>["variant"];
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size="icon"
      aria-label="Share profile"
      // Icon inherits the button's text color (currentColor) so callers can
      // tune it via className — muted on /to, default-foreground on the banner.
      className={className}
      onClick={() => onShare(username)}
    >
      <Share2Icon className="size-4" />
    </Button>
  );
}
