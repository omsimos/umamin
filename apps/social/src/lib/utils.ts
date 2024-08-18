import { formatDistanceToNow, fromUnixTime } from "date-fns";

export function shortTimeAgo(epoch: number) {
  const distance = formatDistanceToNow(fromUnixTime(epoch));

  if (distance === "less than a minute") {
    return "just now";
  }

  const minutesMatch = distance.match(/(\d+)\s+min/);
  if (minutesMatch) {
    return `${minutesMatch[1]}m`;
  }

  const hoursMatch = distance.match(/(\d+)\s+hour/);
  if (hoursMatch) {
    return `${hoursMatch[1]}h`;
  }

  const daysMatch = distance.match(/(\d+)\s+day/);
  if (daysMatch) {
    return `${daysMatch[1]}d`;
  }

  const monthsMatch = distance.match(/(\d+)\s+month/);
  if (monthsMatch) {
    return `${monthsMatch[1]}mo`;
  }

  const yearsMatch = distance.match(/(\d+)\s+year/);
  if (yearsMatch) {
    return `${yearsMatch[1]}y`;
  }

  return distance;
}
