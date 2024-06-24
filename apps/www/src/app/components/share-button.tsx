"use client";

import { Share2 } from "lucide-react";
import { analytics } from "@/lib/firebase";
import { logEvent } from "firebase/analytics";

const onShare = (username: string) => {
  if (typeof window !== "undefined") {
    const url = `${window.location.origin}/user/${username}`;

    if (
      navigator.share &&
      navigator.canShare({ url }) &&
      process.env.NODE_ENV === "production"
    ) {
      navigator.share({ url });
    } else {
      navigator.clipboard.writeText(
        `${window.location.origin}/user/${username}`,
      );
    }

    logEvent(analytics, "share_profile");
  }
};

export function ShareButton({ username }: { username: string }) {
  return (
    <button onClick={() => onShare(username)}>
      <Share2 className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
