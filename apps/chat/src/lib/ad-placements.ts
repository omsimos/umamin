export const AD_CLIENT = "ca-pub-4274133898976040";

export const adPlacements = {
  lobby: { slotId: "", minHeight: 280, lazy: true },
  ended: { slotId: "", minHeight: 280, lazy: false },
} as const;

export type AdPlacement = keyof typeof adPlacements;

export function adsEnabled(): boolean {
  if (!import.meta.env.PROD) return false;
  if (typeof window === "undefined") return false;
  return !window.location.hostname.includes("localhost");
}
