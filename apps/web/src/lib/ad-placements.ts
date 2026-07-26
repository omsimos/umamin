export const adPlacements = {
  feed_top: {
    slotId: "9864130654",
    minHeight: 280,
    lazy: false,
  },
  feed_inline: {
    slotId: "8551048984",
    minHeight: 280,
    lazy: false,
  },
  notes_top: {
    slotId: "1999152698",
    minHeight: 280,
    lazy: false,
  },
  notes_inline: {
    slotId: "9012650581",
    minHeight: 280,
    lazy: false,
  },
  profile_bottom: {
    slotId: "4417432474",
    minHeight: 250,
    lazy: true,
  },
  post_detail: {
    slotId: "4417573957",
    minHeight: 280,
    lazy: false,
  },
  to_user: {
    slotId: "6964636231",
    minHeight: 250,
    lazy: true,
  },
  profile_top: {
    slotId: "3990946976",
    minHeight: 250,
    lazy: true,
  },
  inbox_top: {
    slotId: "1117371626",
    minHeight: 250,
    lazy: false,
  },
  notes_input_top: {
    slotId: "7491208286",
    minHeight: 250,
    lazy: false,
  },
} as const;

export type AdPlacement = keyof typeof adPlacements;

export const AD_CLIENT = "ca-pub-4274133898976040";

/** Rows between in-feed ad units (feed + notes). */
export const AD_FREQUENCY = 8;

/**
 * Ceiling on in-feed units per mounted list. An initialized AdSense slot is a
 * live iframe with its own document and scripts, and nothing unmounts it while
 * the list stays mounted — so an uncapped one-per-8 rule accumulates ~25 of them
 * over a 200-row scroll, which dominates memory on the deep-scroll path. The
 * units dropped past this point are also the least likely to ever be viewed.
 */
export const MAX_IN_FEED_ADS = 6;

/** Whether the row at `index` (0-based) is followed by an in-feed ad unit. */
export function shouldShowInFeedAd(index: number): boolean {
  const position = index + 1;
  if (position % AD_FREQUENCY !== 0) return false;
  return position / AD_FREQUENCY <= MAX_IN_FEED_ADS;
}
