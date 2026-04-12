"use client";

import type { ComponentProps } from "react";
import { RouteSegmentError } from "@/components/route-segment-error";

export default function SettingsError(
  props: ComponentProps<typeof RouteSegmentError>,
) {
  return <RouteSegmentError {...props} heading="We couldn’t load settings." />;
}
