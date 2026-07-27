export function isStandaloneMode() {
  if (typeof window === "undefined") {
    return false;
  }

  const matchStandalone = window.matchMedia?.(
    "(display-mode: standalone)",
  )?.matches;
  const iosStandalone =
    typeof navigator !== "undefined" &&
    "standalone" in navigator &&
    navigator.standalone === true;

  return Boolean(matchStandalone || iosStandalone);
}
