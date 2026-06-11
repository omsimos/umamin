/** Shared visual system for the story-size share images (receipt + invite). */

export const CARD_W = 1080;
export const CARD_H = 1920;

export const DISPLAY_FONT =
  '"Bricolage Grotesque Variable", system-ui, sans-serif';
export const SANS_FONT = '"Geist Variable", system-ui, sans-serif';

// The short domain (redirects to chat.umamin.link, query string preserved) —
// what people retype from a story image.
export const INVITE_BASE_URL = "https://umamin.chat";
export const DISPLAY_HOST = "umamin.chat";

export const CARD_COLORS = {
  paper: "#fafafa",
  ink: "#18181b",
  muted: "#71717a",
  faint: "#d4d4d8",
};

/** Brand pubmat palette — the cards must look like the official story/square
 *  pubmats (near-black, magenta glows, left-aligned editorial layout). */
export const PUBMAT = {
  magenta: "#ec0e8c",
  bg: "#0a090c",
  fg: "#f7f7f9",
  muted: "#9b9aa6",
  border: "rgba(255,255,255,0.12)",
};

/** The pubmat backdrop: base, a strong magenta glow top-right, a soft one
 *  bottom-left, and an edge vignette. Drop the defs+rects at the top of a
 *  CARD_W×CARD_H SVG. */
export function pubmatBackdropSvg(): string {
  return `<defs>
    <radialGradient id="pm-glow-a" cx="0.84" cy="-0.08" r="0.95">
      <stop offset="0" stop-color="${PUBMAT.magenta}" stop-opacity="0.45" />
      <stop offset="0.58" stop-color="${PUBMAT.magenta}" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="pm-glow-b" cx="-0.12" cy="1.1" r="0.82">
      <stop offset="0" stop-color="${PUBMAT.magenta}" stop-opacity="0.22" />
      <stop offset="0.55" stop-color="${PUBMAT.magenta}" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="pm-vignette" cx="0.5" cy="0.36" r="0.95">
      <stop offset="0.5" stop-color="#000" stop-opacity="0" />
      <stop offset="1" stop-color="#000" stop-opacity="0.5" />
    </radialGradient>
  </defs>
  <rect width="${CARD_W}" height="${CARD_H}" fill="${PUBMAT.bg}" />
  <rect width="${CARD_W}" height="${CARD_H}" fill="url(#pm-glow-a)" />
  <rect width="${CARD_W}" height="${CARD_H}" fill="url(#pm-glow-b)" />
  <rect width="${CARD_W}" height="${CARD_H}" fill="url(#pm-vignette)" />`;
}

/** Rough text width for pill/chip sizing — pure templates can't measureText.
 *  Tuned for Geist at the given size; emoji count as ~1.3 chars. */
export function estTextWidth(text: string, fontSize: number): number {
  let units = 0;
  for (const ch of text) {
    units += ch.charCodeAt(0) > 0x2000 ? 1.3 : 0.58;
  }
  return units * fontSize;
}

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** Decorative barcode strokes (receipt flavor) as SVG rects. */
export function barcodeSvg(
  x: number,
  y: number,
  width: number,
  height: number,
  seed: string,
): string {
  const h = hash(seed);
  let cursor = 0;
  const bars: string[] = [];
  let i = 0;
  while (cursor < width) {
    const w = 4 + ((h >> (i % 24)) & 7) * 3;
    if ((i + (h % 3)) % 2 === 0) {
      bars.push(
        `<rect x="${x + cursor}" y="${y}" width="${w}" height="${height}" fill="${CARD_COLORS.ink}" />`,
      );
    }
    cursor += w + 4;
    i++;
  }
  return bars.join("");
}
