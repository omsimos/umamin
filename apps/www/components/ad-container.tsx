"use client";

import { cn } from "@umamin/ui/lib/utils";
import { useEffect, useRef, useState } from "react";
import { type AdPlacement, adPlacements } from "@/lib/ad-placements";

declare global {
  interface Window {
    // biome-ignore lint/suspicious/noExplicitAny: google
    adsbygoogle: any;
  }
}

type Props = {
  placement: AdPlacement;
  className?: string;
};

const AdContainer = ({ placement, className }: Props) => {
  const config = adPlacements[placement];
  const containerRef = useRef<HTMLDivElement | null>(null);
  const adRef = useRef<HTMLModElement | null>(null);
  const pushedRef = useRef(false);
  const [isVisible, setIsVisible] = useState(!config.lazy);
  const shouldInitialize = isVisible || process.env.NODE_ENV !== "production";

  useEffect(() => {
    pushedRef.current = false;
    setIsVisible(!config.lazy);
  }, [config.lazy]);

  useEffect(() => {
    if (!config.lazy || isVisible || !containerRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "200px 0px",
        threshold: 0.1,
      },
    );

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [config.lazy, isVisible]);

  useEffect(() => {
    if (
      !shouldInitialize ||
      process.env.NODE_ENV !== "production" ||
      typeof window === "undefined" ||
      window.location.hostname.includes("localhost")
    ) {
      return;
    }

    let timeoutId: number | null = null;
    let disposed = false;

    const initializeAd = () => {
      if (disposed || pushedRef.current) {
        return;
      }

      const adElement = adRef.current;
      if (!adElement) {
        timeoutId = window.setTimeout(initializeAd, 150);
        return;
      }

      if (adElement.getAttribute("data-adsbygoogle-status") === "done") {
        pushedRef.current = true;
        return;
      }

      try {
        // biome-ignore lint/suspicious/noAssignInExpressions: google
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        pushedRef.current = true;
      } catch (err) {
        console.log(err);
        timeoutId = window.setTimeout(initializeAd, 250);
      }
    };

    initializeAd();

    return () => {
      disposed = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [shouldInitialize]);

  return (
    <div
      ref={containerRef}
      className={cn("w-full", className, {
        "border border-yellow-500 rounded":
          process.env.NODE_ENV === "development",
      })}
      style={{ minHeight: config.minHeight }}
    >
      {process.env.NODE_ENV === "development" ? (
        <div className="flex h-full min-h-full items-center justify-center rounded text-sm text-yellow-700">
          ad: {placement}
        </div>
      ) : (
        shouldInitialize && (
          <ins
            ref={adRef}
            className="adsbygoogle"
            style={{ display: "block", minHeight: config.minHeight }}
            data-ad-client="ca-pub-4274133898976040"
            data-ad-slot={config.slotId}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        )
      )}
    </div>
  );
};

export default AdContainer;
