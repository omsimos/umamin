import { useEffect } from "react";
import { AD_CLIENT, ADS_ENABLED } from "@/lib/ad-placements";

export const ADSENSE_SCRIPT_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`;

// Requests adsbygoogle.js only once React has hydrated. As an async <head>
// script it often ran first on slow phones, and its auto-placed ad divs landed
// inside React-owned markup — the server/client mismatch behind most React
// #418 reports. Slots that mount earlier have already pushed onto the
// window.adsbygoogle queue, which the script drains when it arrives.
export function AdsenseLoader() {
  useEffect(() => {
    if (!import.meta.env.PROD || !ADS_ENABLED) return;
    if (document.querySelector(`script[src="${ADSENSE_SCRIPT_SRC}"]`)) return;
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = ADSENSE_SCRIPT_SRC;
    document.head.appendChild(script);
  }, []);

  return null;
}
