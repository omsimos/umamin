"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isStandaloneMode } from "@/lib/pwa";

// The installed app launches at /feed (manifest start_url), so it never loads
// the marketing landing. This is the safety net for the rare in-app navigation
// back to "/": standalone users are sent to the app home instead. [#35]
export function PwaRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (isStandaloneMode()) {
      router.replace("/feed");
    }
  }, [router]);

  return null;
}
