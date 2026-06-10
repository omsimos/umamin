"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isStandaloneMode } from "@/lib/pwa";

// A TWA / installed PWA always launches at start_url ("/") in standalone mode,
// so the marketing landing must not trap users here. The auth-aware target is
// computed server-side (PwaRedirectGate); we only act once we know we're
// standalone, and replace() so the landing never enters history. [#35]
export function PwaRedirect({ target }: { target: string }) {
  const router = useRouter();

  useEffect(() => {
    if (isStandaloneMode()) {
      router.replace(target);
    }
  }, [router, target]);

  return null;
}
