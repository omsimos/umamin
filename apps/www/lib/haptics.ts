/**
 * Fire a haptic tap where supported. Feature-detected — iOS Safari has no
 * Vibration API, so this degrades silently there — and wrapped so a blocked
 * call (no user gesture, permissions policy) never breaks the caller.
 *
 * The web has no "prefers-reduced-haptics", so reduced-motion is the accepted
 * proxy: users dialing down sensory feedback get neither animation nor buzz.
 */
export function vibrate(pattern: number | number[] = 10) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) {
    return;
  }

  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  try {
    navigator.vibrate(pattern);
  } catch {}
}
