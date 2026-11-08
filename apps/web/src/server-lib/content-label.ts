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
};

type ReviewRow = ScoredRow & {
  modFlaggedAt?: Date | null;
  modClearedAt?: Date | null;
  modReviewedAt?: Date | null;
  modAppealedAt?: Date | null;
};

/**
 * Where a row stands in review, derived from its mod_* columns. Labels, the
 * queue, the drama check and the review actions all read it from here rather
 * than testing columns on their own.
 *
 * - unclassified: no scores yet, read as clean.
 * - clean: scored under every line.
 * - labelled: scored over a line and not in the queue.
 * - queued: in the queue for a high severe score or a viewer's dispute.
 * - appealed: in the queue because its author asked.
 * - kept: a moderator agreed with the label. Out of the queue for good.
 * - cleared: a moderator called the label wrong. No label from then on.
 */
export type ReviewState =
  | "unclassified"
  | "clean"
  | "labelled"
  | "queued"
  | "appealed"
  | "kept"
  | "cleared";

export function reviewState(row: ReviewRow): ReviewState {
  // Cleared outranks kept: a moderator can still uncover a label they kept
  // (from the drama check), but can't keep one they uncovered.
  if (row.modClearedAt) return "cleared";
  if (row.modReviewedAt) return "kept";
  // An appeal stamps the flag too, and the queue's index reads only the flag.
  if (row.modFlaggedAt) return row.modAppealedAt ? "appealed" : "queued";
  if (row.modSevere == null && row.modDrama == null) return "unclassified";
  return scoreLabel(row) ? "labelled" : "clean";
}

export type ReviewTransition = "clear" | "keep" | "appeal" | "dispute";

const TRANSITIONS: Record<ReviewTransition, readonly ReviewState[]> = {
  clear: ["labelled", "queued", "appealed", "kept"],
  keep: ["queued", "appealed"],
  appeal: ["labelled", "queued", "appealed"],
  dispute: ["labelled", "queued", "appealed"],
};

export function canTransition(state: ReviewState, to: ReviewTransition) {
  return TRANSITIONS[to].includes(state);
}

/** In the review queue. Matches the tables' mod_pending partial indexes. */
export function isPendingReview(state: ReviewState) {
  return state === "queued" || state === "appealed";
}

/** Covered for every viewer, as opposed to drama's opt-out fold. */
export function isCoveredLabel(label: ContentLabel | null) {
  return label === "severe" || label === "scam";
}

function scoreLabel(row: ScoredRow): ContentLabel | null {
  if ((row.modSevere ?? 0) >= SEVERE_THRESHOLD) {
    return row.modReason === "scam" ? "scam" : "severe";
  }
  if ((row.modDrama ?? 0) >= DRAMA_THRESHOLD) return "drama";
  return null;
}

export function contentLabel(
  row: ReviewRow,
  enforce: boolean,
): ContentLabel | null {
  if (!enforce || reviewState(row) === "cleared") return null;
  return scoreLabel(row);
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
