import { cn } from "@umamin/ui/lib/utils";
import { useEffect, useRef, useState } from "react";
import {
  ADS_ENABLED,
  type AdPlacement,
  adPlacements,
} from "@/lib/ad-placements";
import { captureException } from "@/lib/posthog";

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
  const isLazy = config?.lazy ?? true;
  const minHeight = config?.minHeight ?? 0;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const adRef = useRef<HTMLModElement | null>(null);
  const pushedRef = useRef(false);
  const [isVisible, setIsVisible] = useState(!isLazy);
  const shouldInitialize = isVisible || !import.meta.env.PROD;

  useEffect(() => {
    pushedRef.current = false;
    setIsVisible(!isLazy);
  }, [isLazy]);

  useEffect(() => {
    if (!config || !isLazy || isVisible || !containerRef.current) {
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
  }, [config, isLazy, isVisible]);

  useEffect(() => {
    if (config || import.meta.env.PROD) {
      return;
    }

    console.warn(`Unknown ad placement: ${String(placement)}`);
  }, [config, placement]);

  useEffect(() => {
    if (
      !config?.slotId ||
      !shouldInitialize ||
      !import.meta.env.PROD ||
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
        captureException(err, { source: "ads" });
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
  }, [config, shouldInitialize]);

  // Second guard behind ClientOnlyAdContainer's, after the hooks so their order
  // stays stable: a direct render of this component can't reintroduce a slot
  // (or the dev placeholder box) while the switch is off.
  if (!ADS_ENABLED) return null;

  return (
    <div
      ref={containerRef}
      className={cn("w-full", className, {
        "border border-yellow-500 rounded": import.meta.env.DEV,
      })}
      style={{ minHeight }}
    >
      {!config ? null : import.meta.env.DEV ? (
        <div className="flex h-full min-h-full items-center justify-center rounded text-sm text-yellow-700">
          ad: {placement}
        </div>
      ) : (
        shouldInitialize &&
        config.slotId && (
          <ins
            ref={adRef}
            className="adsbygoogle"
            style={{ display: "block", minHeight }}
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
