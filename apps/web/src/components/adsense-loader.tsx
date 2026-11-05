import { useEffect } from "react";
import { AD_CLIENT, ADS_ENABLED } from "@/lib/ad-placements";

export const ADSENSE_SCRIPT_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`;

export const ADSENSE_IDLE_TIMEOUT_MS = 3000;
// Browsers without requestIdleCallback (Safari) wait this long after `load`.
export const ADSENSE_NO_IDLE_DELAY_MS = 1000;

// Requests adsbygoogle.js only after the window `load` event and an idle
// period. Auto ads insert nodes wherever they like, and this loader lives in
// the shell, whose effects run before Suspense-wrapped route content
// hydrates; injecting the script on mount let those nodes land in markup React
// had not hydrated yet (React #418). Slots that mount earlier have already
// pushed onto the window.adsbygoogle queue, which the script drains when it
// arrives.
export function AdsenseLoader() {
  useEffect(() => {
    if (!import.meta.env.PROD || !ADS_ENABLED) return;

    let idleId: number | undefined;
    let timeoutId: number | undefined;

    const inject = () => {
      if (document.querySelector(`script[src="${ADSENSE_SCRIPT_SRC}"]`)) return;
      const script = document.createElement("script");
      script.async = true;
      script.crossOrigin = "anonymous";
      script.src = ADSENSE_SCRIPT_SRC;
      document.head.appendChild(script);
    };

    const scheduleWhenIdle = () => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(inject, {
          timeout: ADSENSE_IDLE_TIMEOUT_MS,
        });
      } else {
        timeoutId = window.setTimeout(inject, ADSENSE_NO_IDLE_DELAY_MS);
      }
    };

    if (document.readyState === "complete") {
      scheduleWhenIdle();
    } else {
      window.addEventListener("load", scheduleWhenIdle, { once: true });
    }

    return () => {
      window.removeEventListener("load", scheduleWhenIdle);
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, []);

  return null;
}
