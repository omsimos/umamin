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
} as const;

export type AdPlacement = keyof typeof adPlacements;
