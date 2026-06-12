import { avatarDataUri } from "../avatar";
import { interestById } from "../content";
import {
  barcodeSvg,
  CARD_COLORS,
  CARD_H,
  CARD_W,
  DISPLAY_FONT,
  escapeXml,
  estTextWidth,
  formatDuration,
  PUBMAT,
  pubmatBackdropSvg,
  SANS_FONT,
} from "./theme";
import type {
  CardAssets,
  CardRender,
  ChatReceiptStats,
  ReceiptExtra,
  TextOp,
} from "./types";

/** The printable line items, in order. Pure — drives both render and tests. */
export function receiptLines(stats: ChatReceiptStats): ReceiptExtra[] {
  const lines: ReceiptExtra[] = [];
  if (stats.durationMs !== undefined) {
    lines.push({ label: "DURATION", value: formatDuration(stats.durationMs) });
  }
  if (stats.messageCount !== undefined) {
    lines.push({
      label: "MESSAGES",
      value: stats.messageCountCapped
        ? `${stats.messageCount}+`
        : String(stats.messageCount),
    });
  }
  if (stats.reactionCount !== undefined) {
    lines.push({ label: "REACTIONS", value: String(stats.reactionCount) });
  }
  const vibes = stats.sharedInterests
    .map((id) => interestById(id))
    .filter((i) => i !== undefined)
    .slice(0, 3)
    .map((i) => `${i.emoji} ${i.label}`);
  if (vibes.length > 0) {
    lines.push({ label: "SHARED VIBES", value: vibes.join(" · ") });
  }
  return [...lines, ...(stats.extras ?? [])];
}

const PAD = 92;
const BODY_X = 100;
const BODY_W = CARD_W - BODY_X * 2;

/** The footer (logo + domain) tops out here — the paper must stay above it.
 *  Exported for the geometry regression test. */
export const RECEIPT_FOOTER_TOP = CARD_H - 230;

/** Story-size receipt in the brand pubmat language: the paper receipt floats
 *  on the near-black, magenta-glow backdrop, under a left-aligned eyebrow and
 *  above the logo + domain footer. */
export function buildReceiptCard(
  stats: ChatReceiptStats,
  assets: CardAssets = {},
): CardRender {
  const lines = receiptLines(stats);

  // The story height is fixed, so past five line items the whole layout
  // compresses (smaller avatars, tighter header and row spacing) — at the
  // maximum nine rows the paper bottom still clears the footer.
  const compact = lines.length >= 6;
  const top = compact ? 280 : 330; // receipt body top
  const avatarR = compact ? 92 : 110;
  const avatarCy = top + (compact ? 120 : 150);
  const titleY = top + (compact ? 300 : 360);
  const subY = top + (compact ? 356 : 420);
  const dateY = top + (compact ? 408 : 480);
  const lineStartY = top + (compact ? 490 : 590);
  const lineStep = compact ? 74 : 86;
  const linesEndY = lineStartY + lines.length * lineStep;
  const barcodeY = linesEndY + (compact ? 40 : 60);
  const bodyBottom = barcodeY + 180;
  const cx = CARD_W / 2;

  const selfUri = escapeXml(avatarDataUri(stats.self.avatarSeed));
  const partnerUri = escapeXml(avatarDataUri(stats.partner.avatarSeed));

  const svgParts: string[] = [pubmatBackdropSvg()];
  const texts: TextOp[] = [];

  // ── Eyebrow ───────────────────────────────────────────────────────────
  const eyebrow = "✦ CHAT RECEIPT";
  const eyebrowY = 170;
  const eyebrowW = estTextWidth(eyebrow, 26) * 1.25 + 64;
  svgParts.push(
    `<rect x="${PAD}" y="${eyebrowY}" width="${eyebrowW}" height="60" rx="30" fill="rgba(236,14,140,0.12)" stroke="rgba(236,14,140,0.5)" stroke-width="2" />`,
  );
  texts.push({
    text: eyebrow,
    x: PAD + 32,
    y: eyebrowY + 40,
    font: `600 26px ${SANS_FONT}`,
    fill: PUBMAT.magenta,
    letterSpacing: "0.2em",
  });

  // ── Paper receipt with the pair's avatars on its top edge ─────────────
  svgParts.push(
    `<rect x="${BODY_X}" y="${top}" width="${BODY_W}" height="${bodyBottom - top}" rx="28" fill="${CARD_COLORS.paper}" />`,
    `<line x1="${BODY_X + 40}" y1="${top + 50}" x2="${BODY_X + BODY_W - 40}" y2="${top + 50}" stroke="${CARD_COLORS.faint}" stroke-width="3" stroke-dasharray="2 14" />`,
    `<line x1="${BODY_X + 40}" y1="${bodyBottom - 50}" x2="${BODY_X + BODY_W - 40}" y2="${bodyBottom - 50}" stroke="${CARD_COLORS.faint}" stroke-width="3" stroke-dasharray="2 14" />`,
    `<clipPath id="rc-self"><circle cx="${cx - 90}" cy="${avatarCy}" r="${avatarR}" /></clipPath>`,
    `<clipPath id="rc-partner"><circle cx="${cx + 90}" cy="${avatarCy}" r="${avatarR}" /></clipPath>`,
    `<circle cx="${cx - 90}" cy="${avatarCy}" r="${avatarR + 8}" fill="#ffffff" stroke="${CARD_COLORS.faint}" stroke-width="3" />`,
    `<circle cx="${cx + 90}" cy="${avatarCy}" r="${avatarR + 8}" fill="#ffffff" stroke="${CARD_COLORS.faint}" stroke-width="3" />`,
    `<image href="${partnerUri}" x="${cx + 90 - avatarR}" y="${avatarCy - avatarR}" width="${avatarR * 2}" height="${avatarR * 2}" clip-path="url(#rc-partner)" />`,
    `<image href="${selfUri}" x="${cx - 90 - avatarR}" y="${avatarCy - avatarR}" width="${avatarR * 2}" height="${avatarR * 2}" clip-path="url(#rc-self)" />`,
    ...lines.map(
      (_, i) =>
        `<line x1="${BODY_X + 60}" y1="${lineStartY + (i + 1) * lineStep - 54}" x2="${BODY_X + BODY_W - 60}" y2="${lineStartY + (i + 1) * lineStep - 54}" stroke="${CARD_COLORS.faint}" stroke-width="2" stroke-dasharray="2 10" />`,
    ),
    barcodeSvg(BODY_X + 120, barcodeY, BODY_W - 240, 90, stats.matchId),
  );

  texts.push(
    {
      text: `${stats.self.alias} × ${stats.partner.alias}`,
      x: cx,
      y: titleY,
      font: `800 64px ${DISPLAY_FONT}`,
      fill: CARD_COLORS.ink,
      align: "center",
      maxWidth: BODY_W - 120,
    },
    {
      text: "ANONYMOUS CHAT RECEIPT",
      x: cx,
      y: subY,
      font: `500 28px ${SANS_FONT}`,
      fill: CARD_COLORS.muted,
      align: "center",
      letterSpacing: "0.12em",
    },
    {
      text: new Date(stats.endedAt).toISOString().slice(0, 10),
      x: cx,
      y: dateY,
      font: `400 26px ${SANS_FONT}`,
      fill: CARD_COLORS.muted,
      align: "center",
    },
    ...lines.flatMap((line, i): TextOp[] => [
      {
        text: line.label,
        x: BODY_X + 60,
        y: lineStartY + i * lineStep,
        font: `500 30px ${SANS_FONT}`,
        fill: CARD_COLORS.muted,
      },
      {
        text: line.value,
        x: BODY_X + BODY_W - 60,
        y: lineStartY + i * lineStep,
        font: `700 34px ${SANS_FONT}`,
        fill: CARD_COLORS.ink,
        align: "right",
        maxWidth: 460,
      },
    ]),
    {
      text: "nothing was saved — that's the point",
      x: cx,
      y: barcodeY + 140,
      font: `400 26px ${SANS_FONT}`,
      fill: CARD_COLORS.muted,
      align: "center",
    },
  );

  // ── Footer: logo + domain + magenta arrow. The bottom inset mirrors the
  // eyebrow's top inset and clears story UI overlays.
  const footBaseline = CARD_H - 180;
  let footX = PAD;
  if (assets.logoDataUri) {
    svgParts.push(
      `<image href="${escapeXml(assets.logoDataUri)}" x="${PAD}" y="${footBaseline - 50}" width="62" height="62" />`,
    );
    footX += 86;
  }
  const domain = "umamin.chat";
  texts.push(
    {
      text: domain,
      x: footX,
      y: footBaseline,
      font: `700 48px ${DISPLAY_FONT}`,
      fill: PUBMAT.fg,
    },
    {
      text: "→",
      x: footX + estTextWidth(domain, 48) + 26,
      y: footBaseline,
      font: `700 48px ${DISPLAY_FONT}`,
      fill: PUBMAT.magenta,
    },
  );

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}">
  ${svgParts.join("\n  ")}
</svg>`;

  return { svg, texts, width: CARD_W, height: CARD_H };
}
