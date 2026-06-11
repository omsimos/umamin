import { avatarDataUri } from "../avatar";
import { interestById } from "../content";
import {
  CARD_H,
  CARD_W,
  DISPLAY_FONT,
  escapeXml,
  estTextWidth,
  PUBMAT,
  pubmatBackdropSvg,
  SANS_FONT,
} from "./theme";
import type { CardAssets, CardRender, InviteCardInput, TextOp } from "./types";

const PAD = 92;
const AVATAR_R = 84;

/** Story-size personal invite in the brand pubmat language: near-black with
 *  magenta glows, left-aligned hero (eyebrow → display headline with magenta
 *  accent → muted sub → interest chips), and the logo + domain footer. */
export function buildInviteCard(
  input: InviteCardInput,
  assets: CardAssets = {},
): CardRender {
  const avatarUri = escapeXml(avatarDataUri(input.avatarSeed));

  const interests = (input.interests ?? [])
    .map((id) => interestById(id))
    .filter((i) => i !== undefined)
    .slice(0, 6);

  const svgParts: string[] = [pubmatBackdropSvg()];
  const texts: TextOp[] = [];

  // ── Hero: avatar, eyebrow, headline, sub ──────────────────────────────
  const avatarCy = 470;
  svgParts.push(
    `<circle cx="${PAD + AVATAR_R}" cy="${avatarCy}" r="${AVATAR_R + 10}" fill="${PUBMAT.bg}" stroke="${PUBMAT.border}" stroke-width="2" />`,
    `<clipPath id="inv-av"><circle cx="${PAD + AVATAR_R}" cy="${avatarCy}" r="${AVATAR_R}" /></clipPath>`,
    `<image href="${avatarUri}" x="${PAD}" y="${avatarCy - AVATAR_R}" width="${AVATAR_R * 2}" height="${AVATAR_R * 2}" clip-path="url(#inv-av)" />`,
  );

  const eyebrow = "✦ CHAT WITH ME";
  const eyebrowY = 640;
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

  texts.push(
    {
      text: "Anonymous chat",
      x: PAD,
      y: 836,
      font: `800 86px ${DISPLAY_FONT}`,
      fill: PUBMAT.fg,
      maxWidth: CARD_W - PAD * 2,
    },
    {
      text: `with ${input.alias}.`,
      x: PAD,
      y: 928,
      font: `800 86px ${DISPLAY_FONT}`,
      fill: PUBMAT.magenta,
      maxWidth: CARD_W - PAD * 2,
    },
  );

  const subLines = [
    "Open my link while I'm searching",
    "and you'll land right on me.",
    "No sign-up, nothing saved.",
  ];
  subLines.forEach((line, i) => {
    texts.push({
      text: line,
      x: PAD,
      y: 1024 + i * 56,
      font: `400 40px ${SANS_FONT}`,
      fill: PUBMAT.muted,
    });
  });

  // ── Interest chips (pubmat chips, all "on") ───────────────────────────
  let chipX = PAD;
  let chipY = 1268;
  const chipH = 64;
  for (const interest of interests) {
    const label = `${interest.emoji} ${interest.label}`;
    const w = estTextWidth(label, 31) + 60;
    if (chipX + w > CARD_W - PAD) {
      chipX = PAD;
      chipY += chipH + 18;
    }
    svgParts.push(
      `<rect x="${chipX}" y="${chipY}" width="${w}" height="${chipH}" rx="${chipH / 2}" fill="${PUBMAT.magenta}" />`,
    );
    texts.push({
      text: label,
      x: chipX + w / 2,
      y: chipY + 42,
      font: `600 31px ${SANS_FONT}`,
      fill: "#ffffff",
      align: "center",
      maxWidth: w - 40,
    });
    chipX += w + 18;
  }

  // ── Link-sticker guide — PREVIEW ONLY. The shared image keeps this zone
  // empty so the sticker dropped there never overlaps a painted outline;
  // the share sheet has a copy-link button for it.
  const slotY = 1490;
  const previewSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}">
  <rect x="${PAD}" y="${slotY}" width="${CARD_W - PAD * 2}" height="120" rx="60" fill="none" stroke="${PUBMAT.border}" stroke-width="3" stroke-dasharray="14 14" />
</svg>`;
  const previewTexts: TextOp[] = [
    {
      text: "🔗 your link sticker goes here",
      x: CARD_W / 2,
      y: slotY + 74,
      font: `500 36px ${SANS_FONT}`,
      fill: PUBMAT.muted,
      align: "center",
      maxWidth: CARD_W - PAD * 2 - 80,
    },
  ];

  // ── Footer: logo + domain + magenta arrow (the pubmat signature). The
  // bottom inset mirrors the top and clears story UI overlays.
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

  return {
    svg,
    texts,
    width: CARD_W,
    height: CARD_H,
    previewSvg,
    previewTexts,
  };
}
