"use client";

import { useEffect } from "react";
import { cn } from "../lib/utils";

declare global {
  interface Window {
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
        typeof window !== "undefined"
      ) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch (err) {
      console.log(err);
    }
  }, []);

  return (
    <div
      className={cn(
        "w-full",
        {
          "h-44 border border-yellow-500 rounded":
            process.env.NODE_ENV === "development",
        },
        className
      )}
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
