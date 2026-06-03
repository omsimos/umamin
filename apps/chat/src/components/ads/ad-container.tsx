import { cn } from "@umamin/ui/lib/utils";
import { useEffect, useRef, useState } from "react";
import {
  AD_CLIENT,
  type AdPlacement,
  adPlacements,
  adsEnabled,
} from "../../lib/ad-placements";

declare global {
  interface Window {
    // biome-ignore lint/suspicious/noExplicitAny: google global
    adsbygoogle: any;
  }
}

export function AdContainer({
  placement,
  className,
}: {
  placement: AdPlacement;
  className?: string;
}) {
  const config = adPlacements[placement];
  const slotId = config?.slotId ?? "";
  const minHeight = config?.minHeight ?? 0;
  const isLazy = config?.lazy ?? true;
  const enabled = adsEnabled();
  const showReal = enabled && Boolean(slotId);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const adRef = useRef<HTMLModElement | null>(null);
  const pushedRef = useRef(false);
  const [visible, setVisible] = useState(!isLazy);

  useEffect(() => {
    if (!showReal || !isLazy || visible || !containerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px", threshold: 0.1 },
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [showReal, isLazy, visible]);

  useEffect(() => {
    if (!showReal || !visible || pushedRef.current) return;
    const el = adRef.current;
    if (!el) return;
    if (el.getAttribute("data-adsbygoogle-status") === "done") {
      pushedRef.current = true;
      return;
    }
    try {
      // biome-ignore lint/suspicious/noAssignInExpressions: google global
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushedRef.current = true;
    } catch (err) {
      console.error("adsbygoogle push failed", err);
    }
  }, [showReal, visible]);

  if (!slotId) return null;
  if (!enabled) {
    return import.meta.env.DEV ? (
      <div
        className={cn(
          "text-muted-foreground flex w-full items-center justify-center rounded border border-dashed py-6 text-xs",
          className,
        )}
        style={{ minHeight }}
      >
        ad: {placement}
      </div>
    ) : null;
  }

  return (
    <div
      ref={containerRef}
      className={cn("w-full", className)}
      style={{ minHeight }}
    >
      {visible && (
        <ins
          ref={adRef}
          className="adsbygoogle"
          style={{ display: "block", minHeight }}
          data-ad-client={AD_CLIENT}
          data-ad-slot={slotId}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      )}
    </div>
  );
}
