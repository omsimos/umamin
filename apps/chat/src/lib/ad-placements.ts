/** Same AdSense publisher as apps/www. */
export const AD_CLIENT = "ca-pub-4274133898976040";

/**
 * Manual ad units, mirroring apps/www/lib/ad-placements.ts. `slotId` is the
 * AdSense ad-unit slot (public, not a secret) — paste the real IDs here once the
 * units are created. An empty `slotId` makes <AdContainer> render nothing, so it
 * is safe to ship before the units exist.
 */
export const adPlacements = {
  lobby: { slotId: "", minHeight: 280, lazy: true },
  ended: { slotId: "", minHeight: 280, lazy: false },
} as const;

export type AdPlacement = keyof typeof adPlacements;

/**
 * Ads only run in a production build on a non-localhost host (mirrors www's
 * NODE_ENV + localhost gate). Centralized here so the component can be unit
 * tested by mocking this function.
 */
export function adsEnabled(): boolean {
  if (!import.meta.env.PROD) return false;
  if (typeof window === "undefined") return false;
  return !window.location.hostname.includes("localhost");
}
