import { useEffect } from "react";
import { initErrorTracking } from "@/lib/posthog";

export function ErrorTracking() {
  useEffect(() => {
    initErrorTracking();
  }, []);

  return null;
}
