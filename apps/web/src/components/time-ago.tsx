import { shortTimeAgo } from "@/lib/utils";

// Built into the platform — avoids shipping date-fns `format()` (and its locale
// tables) into the hot feed/profile/chat client bundles just for a hover title.
const exactTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

// Machine-readable + hover-for-exact-time timestamp. Replaces the plain
// `<p>{shortTimeAgo(date)}</p>` scattered across the cards.
export function TimeAgo({
  date,
  className,
}: {
  date: Date | string;
  className?: string;
}) {
  const d = typeof date === "string" ? new Date(date) : date;

  // Guard invalid input so dateTime={d.toISOString()} can't throw at render.
  if (Number.isNaN(d.getTime())) {
    return null;
  }

  // The relative text depends on the renderer's clock and the title on its
  // timezone, so SSR (workerd, UTC) and the client legitimately disagree;
  // skip the hydration check on this leaf rather than fail the whole root.
  return (
    <time
      suppressHydrationWarning
      dateTime={d.toISOString()}
      title={exactTimeFormatter.format(d)}
      className={className}
    >
      {shortTimeAgo(d)}
    </time>
  );
}
