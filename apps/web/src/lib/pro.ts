// Umamin Pro — a one-time purchase of PRO_TERM_MONTHS of Pro, sold through
// Lemon Squeezy. NOT a subscription: nothing recurs, nothing to cancel; buying
// again stacks on top of the remaining time. This module is client-safe and
// pure (display constants + entitlement math); the payment integration lives
// server-side in server-lib/lemonsqueezy.ts and server-lib/pro.ts.

export const PRO_PRICE_PHP = 129;
export const PRO_TERM_MONTHS = 6;
// The "≈₱21/month" marketing line, floored so it never overstates.
export const PRO_PER_MONTH_PHP = Math.floor(PRO_PRICE_PHP / PRO_TERM_MONTHS);

export const PRO_CHECKOUT_UNAVAILABLE_ERROR =
  "Checkout isn't available right now. Please try again later.";
export const PRO_REQUIRED_ERROR = "This perk needs an active Umamin Pro.";

// Profile theme tokens — a fixed, curated palette (never arbitrary CSS; the
// stored value is validated against this list on write AND on render). Each
// token maps to a scoped CSS-variable class in globals.css that recolors the
// primary/ring tokens on the wearer's profile and /to pages; the class map
// lives in components/pro-flair.tsx.
export const PRO_THEMES = [
  "ocean",
  "forest",
  "ember",
  "orchid",
  "gold",
  "mono",
] as const;
export type ProTheme = (typeof PRO_THEMES)[number];

/**
 * The theme to render for a profile, or null. Entitlement is re-checked here
 * (not just at write time): the stored preference survives a Pro lapse but
 * renders nothing until renewal — the equippedGroupId dangling-ref pattern.
 * Unknown stored tokens also resolve to null.
 */
export function activeProTheme(
  user?: {
    proUntil?: Date | string | null;
    profileTheme?: string | null;
  } | null,
  now: number = Date.now(),
): ProTheme | null {
  if (!hasUmaminPro(user?.proUntil, now)) return null;
  const theme = user?.profileTheme;
  return theme && (PRO_THEMES as readonly string[]).includes(theme)
    ? (theme as ProTheme)
    : null;
}

/**
 * Whether a Pro horizon is still in the future. Mirrors hasUmaminPlus: a
 * client-side gate only — anything Pro actually protects must re-check
 * server-side against the user row.
 */
export function hasUmaminPro(
  proUntil?: Date | string | null,
  now: number = Date.now(),
): boolean {
  if (!proUntil) return false;

  const until = new Date(proUntil);
  if (Number.isNaN(until.getTime())) return false;

  return until.getTime() > now;
}

// Calendar-month add that CLAMPS to the target month's last day instead of
// rolling over (Aug 31 + 6mo → Feb 28/29, not Mar 2/3) — "6 months" must never
// quietly land in the wrong month. UTC so the result is timezone-independent.
export function addMonthsClamped(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

/**
 * Derives the Pro horizon from the full purchase history: each non-refunded
 * purchase extends from whichever is later — the previous horizon or its own
 * purchase time — so stacked purchases never lose paid-for time. Refunds are
 * handled by re-running this over the remaining rows; deriving (instead of
 * incrementing/decrementing a stored date) makes webhook redelivery and
 * refund ordering converge on the same answer.
 */
export function computeProUntil(
  purchases: { createdAt: Date; refundedAt?: Date | null }[],
  termMonths: number = PRO_TERM_MONTHS,
): Date | null {
  const active = purchases
    .filter((purchase) => !purchase.refundedAt)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  let until: Date | null = null;
  for (const purchase of active) {
    const start =
      until && until.getTime() > purchase.createdAt.getTime()
        ? until
        : purchase.createdAt;
    until = addMonthsClamped(start, termMonths);
  }
  return until;
}
