import type { ErrorInfo } from "react";
import { whenIdle } from "@/lib/early-errors";
import { captureException } from "@/lib/posthog";

const COMPONENT_STACK_MAX = 4_000;
const IDLE_REPORT_TIMEOUT_MS = 4_000;

// An Error whose stack is React's component stack. Reported as the cause, its
// frames are symbolicated against the uploaded source maps like any other
// stack, which turns the minified frames back into component names.
function componentStackError(componentStack: string): Error {
  const error = new Error("React component stack");
  error.name = "ComponentStack";
  error.stack = `ComponentStack: React component stack${componentStack}`;
  return error;
}

/**
 * hydrateRoot's onRecoverableError. React's default hands the error to
 * window.reportError without errorInfo, and a production hydration mismatch
 * (#418) carries no other clue to where it happened.
 *
 * The page state recorded with it tells apart the outside causes that edit
 * server markup before React hydrates it: AdSense auto ads, browser
 * translation (which wraps text in <font>) and iOS data detectors (which wrap
 * phone numbers and dates in links).
 */
export function reportRecoverableError(
  error: unknown,
  errorInfo: Pick<ErrorInfo, "componentStack">,
): void {
  const componentStack = errorInfo.componentStack?.slice(
    0,
    COMPONENT_STACK_MAX,
  );
  if (componentStack && error instanceof Error && error.cause === undefined) {
    error.cause = componentStackError(componentStack);
  }
  console.error(error);

  const context = {
    source: "recoverable",
    componentStack,
    readyState: document.readyState,
    adsScriptLoaded: Boolean(
      document.querySelector('script[src*="adsbygoogle.js"]'),
    ),
    autoPlacedAds: document.querySelectorAll(".google-auto-placed").length,
    translated: Boolean(
      document.querySelector("html[class*='translated-'], font"),
    ),
    dataDetectorLinks: document.querySelectorAll("a[x-apple-data-detectors]")
      .length,
  };

  // Hydration runs before the SDK's idle-time load; reporting right away would
  // pull the SDK into the critical path.
  whenIdle(() => captureException(error, context), IDLE_REPORT_TIMEOUT_MS);
}
