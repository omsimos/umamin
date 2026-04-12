"use client";

import dynamic from "next/dynamic";
import type { AdPlacement } from "@/lib/ad-placements";

const AdContainer = dynamic(() => import("@/components/ad-container"), {
  ssr: false,
});

type Props = {
  placement: AdPlacement;
  className?: string;
};

export function ClientOnlyAdContainer({ placement, className }: Props) {
  return <AdContainer className={className} placement={placement} />;
}
