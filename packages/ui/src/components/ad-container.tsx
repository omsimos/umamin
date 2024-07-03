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
  inView?: boolean;
}

const AdContainer = ({ slotId, className, inView }: Props) => {
  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" &&
      typeof window !== "undefined"
    ) {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    }
  }, [inView]);

  return (
    <div
      className={cn(className, {
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
