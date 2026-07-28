import { useEffect, useState } from "react";
import AdContainer from "@/components/ad-container";
import { ADS_ENABLED, type AdPlacement } from "@/lib/ad-placements";

type Props = {
  placement: AdPlacement;
  className?: string;
};

// Client-only ad slot. Next used `dynamic(..., { ssr: false })`; under TanStack
// Start the equivalent is a mount guard — the container renders nothing during
// SSR/first paint and mounts the AdSense `<ins>` only in the browser, so the
// server never emits ad markup (and hydration can't mismatch).
export function ClientOnlyAdContainer({ placement, className }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ADS_ENABLED is a build-time literal, so with ads off this is the whole
  // component: no wrapper, no reserved min-height, nothing to hide.
  if (!ADS_ENABLED || !mounted) return null;

  return <AdContainer className={className} placement={placement} />;
}
