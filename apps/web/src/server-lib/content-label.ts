import type { ContentScores } from "./content-classifier";

// Thresholds on the 0-100 scores content-classifier.ts stores. Kept server-side
// so the client only ever sees the derived label, never a score it could use
// to write just under a line. Set from a labelled sample of production posts
// and notes (scripts/moderation-eval.ts). Drama sits high because it is
// collapsed for every viewer by default and indirects are the noisiest
// category: sad or romantic posts addressed to "you" read as parinig.
export const REVIEW_THRESHOLD = 60;
export const SEVERE_THRESHOLD = 80;
export const DRAMA_THRESHOLD = 85;

// "scam" is severe content whose top reason is scam: covered the same way, but
// with its own copy and with links left unclickable.
export type ContentLabel = "severe" | "scam" | "drama";

type ScoredRow = {
  modSevere?: number | null;
  modDrama?: number | null;
  modReason?: string | null;
  modClearedAt?: Date | null;
};

/** Covered for every viewer, as opposed to drama's opt-out fold. */
export function isCoveredLabel(label: ContentLabel | null) {
  return label === "severe" || label === "scam";
}

export function contentLabel(
  row: ScoredRow,
  enforce: boolean,
): ContentLabel | null {
  if (!enforce || row.modClearedAt) return null;
  if ((row.modSevere ?? 0) >= SEVERE_THRESHOLD) {
    return row.modReason === "scam" ? "scam" : "severe";
  }
  if ((row.modDrama ?? 0) >= DRAMA_THRESHOLD) return "drama";
  return null;
}

/** Column values for a freshly classified row. null scores = unclassified. */
export function scoreColumns(scores: ContentScores | null) {
  return {
    modSevere: scores?.severe ?? null,
    modDrama: scores?.drama ?? null,
    modReason: scores?.reason ?? null,
  };
}

/** scoreColumns plus the review-queue fields public content carries. */
export function reviewableScoreColumns(scores: ContentScores | null) {
  return {
    ...scoreColumns(scores),
    modFlaggedAt:
      scores && scores.severe >= REVIEW_THRESHOLD ? new Date() : null,
    modClearedAt: null,
    // A rewritten note is new text: earlier review decisions don't carry over.
    modReviewedAt: null,
    modAppealedAt: null,
  };
}
