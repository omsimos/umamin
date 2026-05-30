import { format } from "date-fns";
import { shortTimeAgo } from "@/lib/utils";

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

  return (
    <time
      dateTime={d.toISOString()}
      title={format(d, "PPpp")}
      className={className}
    >
      {shortTimeAgo(d)}
    </time>
  );
}
