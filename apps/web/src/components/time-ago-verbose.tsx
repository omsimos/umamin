import { formatDistanceToNow } from "date-fns";

const exactTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

// Sentence-form sibling of TimeAgo ("about 2 hours ago") for prose contexts
// like "Joined …" or "blocked …". Its own module so the hot list bundles that
// use TimeAgo don't pull date-fns along.
export function TimeAgoVerbose({
  date,
  className,
}: {
  date: Date | string;
  className?: string;
}) {
  const d = typeof date === "string" ? new Date(date) : date;

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
      {formatDistanceToNow(d, { addSuffix: true })}
    </time>
  );
}
