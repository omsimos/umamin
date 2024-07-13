"use client";

import { useEffect } from "react";
import { cn } from "../lib/utils";

declare global {
  interface Window {
    adsbygoogle: any;
  }
}
interface Props {
  slotId: string;
  className?: string;
  inFeed?: boolean;
}

const AdContainer = ({ slotId, className, inFeed }: Props) => {
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
      className={cn({
        "h-44 border border-yellow-500 rounded":
          process.env.NODE_ENV === "development",
      }, className)}
    >
      {inFeed ? (
        <ins
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-format="fluid"
          data-ad-layout-key="-h7-z+0-3x+go"
          data-ad-client="ca-pub-4274133898976040"
          data-ad-slot={slotId}
        />
      ) : (
        <ins
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client="ca-pub-4274133898976040"
          data-ad-slot={slotId}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      )}
    </div>
  );
};

export default AdContainer;
