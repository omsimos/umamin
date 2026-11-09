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
    // oxlint-disable-next-line typescript/no-explicit-any -- google
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
  // The box (with its min-height) is server-rendered so the slot's space is
  // reserved before hydration; the <ins> only mounts in the browser, so
  // AdSense never fills a node React hasn't hydrated.
  const [mounted, setMounted] = useState(false);
  const shouldInitialize = mounted && (isVisible || !import.meta.env.PROD);

  useEffect(() => {
    setMounted(true);
  }, []);

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
      window.location.hostname.includes("localhost")
    ) {
      return;
    }

    const adElement = adRef.current;
    if (
      !adElement ||
      pushedRef.current ||
      adElement.hasAttribute("data-adsbygoogle-status")
    ) {
      return;
    }

    // One push per <ins>, never retried: a push that throws has usually
    // already claimed or failed this slot, and re-pushing only makes AdSense
    // throw "All 'ins' elements already have ads" on every attempt.
    pushedRef.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      captureException(err, { source: "ads" });
    }
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
