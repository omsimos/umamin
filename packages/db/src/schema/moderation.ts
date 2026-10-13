import { integer, text } from "drizzle-orm/sqlite-core";

// Classifier output stored on the content row itself, so feed reads get it with
// the columns they already select. Scores are 0-100; null means unclassified
// (no key, a timeout, or written before classification existed), which every
// reader treats as clean. Raw scores are server-only: apps/web strips them and
// sends a derived label instead.
export const contentScoreColumns = () => ({
  modSevere: integer("mod_severe"),
  modDrama: integer("mod_drama"),
  modReason: text("mod_reason"),
});

// Public content also feeds the moderator review queue.
export const reviewableContentColumns = () => ({
  ...contentScoreColumns(),
  // Set when mod_severe reaches the review threshold; backs the queue's
  // partial index.
  modFlaggedAt: integer("mod_flagged_at", { mode: "timestamp" }),
  // A moderator marked the flag a false positive; the row gets no label.
  modClearedAt: integer("mod_cleared_at", { mode: "timestamp" }),
});
