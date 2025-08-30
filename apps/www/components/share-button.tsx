"use client";

import { Share2 } from "lucide-react";

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
        navigator.clipboard.writeText(
          `${window.location.origin}/user/${username}`,
        );
      }
    }
  } catch (err) {
    console.log(err);
  }
};

export function ShareButton({ username }: { username: string }) {
  return (
    <button onClick={() => onShare(username)}>
      <Share2 className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
