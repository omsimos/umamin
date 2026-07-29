// `cn` comes from cnfast rather than the usual `twMerge(clsx(...))`
// composition — same signature, same output, less work per call. `cn` runs once
// per rendered element, so on list surfaces (feed, notes, comments) its cost
// scales with the render, and during SSR that cost is billed Worker CPU.
//
// Verified as a drop-in before adopting: 129,936 comparisons against
// twMerge(clsx(...)) across 1,500 distinct class strings scraped from this
// repo's .tsx files, plus Tailwind v4-only syntax (`size-*`, `text-(--var)`,
// `outline-hidden`, `inset-ring`, `not-hover:`, `@max-md:`, `starting:`,
// `field-sizing-*`, arbitrary variants) — byte-identical, zero mismatches.
// Re-run that comparison before bumping cnfast: the merge tables are what drift.
export { type ClassValue, cn } from "cnfast";
