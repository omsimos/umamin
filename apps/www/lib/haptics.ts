/**
 * Fire a haptic tap where supported. Feature-detected — iOS Safari has no
 * Vibration API, so this degrades silently there — and wrapped so a blocked
 * call (no user gesture, permissions policy) never breaks the caller.
 */
export function vibrate(pattern: number | number[] = 10) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) {
    return;
  }

  try {
    navigator.vibrate(pattern);
  } catch {}
}
