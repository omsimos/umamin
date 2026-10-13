import { cn } from "@umamin/ui/lib/utils";

const ink = {
  stroke: "var(--uma-ink)",
  strokeLinejoin: "round",
  strokeLinecap: "round",
} as const;

/**
 * Uma, the face of the automated content checks: a post card with one corner
 * folded down. Severe covers use the serious mood, which drops the blush and
 * flattens the mouth so the character never smiles over a slur or a doxx.
 * Colors come from the --uma-* tokens in styles.css.
 */
export function Uma({
  mood = "calm",
  className,
}: {
  mood?: "calm" | "serious";
  className?: string;
}) {
  return (
    <svg
      viewBox="10 8 100 86"
      aria-hidden
      className={cn("shrink-0", className)}
      data-mood={mood}
    >
      <path
        d="M20 26a10 10 0 0 1 10-10H80L102 38V78a10 10 0 0 1-10 10H30a10 10 0 0 1-10-10Z"
        fill="var(--uma-body)"
        strokeWidth={5}
        {...ink}
      />
      <path
        d="M80 16V30a8 8 0 0 0 8 8H102Z"
        fill="var(--uma-fold)"
        strokeWidth={5}
        {...ink}
      />
      <ellipse cx="50" cy="56" rx="3.4" ry="4.4" fill="var(--uma-ink)" />
      <ellipse cx="72" cy="56" rx="3.4" ry="4.4" fill="var(--uma-ink)" />
      {mood === "serious" ? (
        <path d="M57 66.5h8" strokeWidth={2.4} {...ink} />
      ) : (
        <>
          <circle
            cx="42"
            cy="66"
            r="4.6"
            fill="var(--uma-cheek)"
            fillOpacity={0.75}
          />
          <circle
            cx="80"
            cy="66"
            r="4.6"
            fill="var(--uma-cheek)"
            fillOpacity={0.75}
          />
          <path d="M57 65q4 4 8 0" fill="none" strokeWidth={2.4} {...ink} />
        </>
      )}
    </svg>
  );
}
