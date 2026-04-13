"use client";

import type { ComponentProps } from "react";
import { RouteSegmentError } from "@/components/route-segment-error";

export default function RootError(
  props: ComponentProps<typeof RouteSegmentError>,
) {
  return <RouteSegmentError {...props} />;
}
