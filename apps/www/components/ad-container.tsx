"use client";

import { cn } from "@umamin/ui/lib/utils";
import { useEffect } from "react";

declare global {
  interface Window {
    // biome-ignore lint/suspicious/noExplicitAny: google
    adsbygoogle: any;
  }
}

type Props = {
  slotId: string;
  className?: string;
};

const AdContainer = ({ slotId, className }: Props) => {
  useEffect(() => {
    try {
      if (
        process.env.NODE_ENV === "production" &&
        typeof window !== "undefined" &&
        !window.location.hostname.includes("localhost")
      ) {
        // biome-ignore lint/suspicious/noAssignInExpressions: google
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch (err) {
      console.log(err);
    }
  }, []);

  return (
    <div
      className={cn("w-full", className, {
        "h-44 border border-yellow-500 rounded":
          process.env.NODE_ENV === "development",
      })}
    >
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client="ca-pub-4274133898976040"
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
};

export default AdContainer;
