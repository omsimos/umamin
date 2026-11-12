// Images per ZIP. One archive holding thousands of 4x PNGs exhausts a phone's
// memory, so a large export downloads as several files.
export const ZIP_PART_SIZE = 200;

export function splitIntoParts<T>(items: T[], size = ZIP_PART_SIZE): T[][] {
  const parts: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    parts.push(items.slice(i, i + size));
  }
  return parts;
}

export function zipPartName(
  username: string,
  index: number,
  total: number,
): string {
  if (total <= 1) return `${username}-messages.zip`;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${username}-messages-part-${pad(index + 1)}-of-${pad(total)}.zip`;
}
