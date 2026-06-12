/**
 * Story-size (1080×1920) profile share card. The layout/copy logic lives in
 * the pure `profileCardModel` (testable in jsdom); `renderProfileCard` is the
 * thin canvas painter. Canvas-native (not SVG) because the banner/avatar are
 * remote images — an SVG rasterized via <img> can't fetch them, while
 * fetch→ImageBitmap keeps the canvas untainted and degrades gracefully when a
 * host doesn't serve CORS headers (the card just skips that image).
 */

export const CARD_W = 1080;
export const CARD_H = 1920;

// Brand pubmat palette — the card must look like the official story pubmats.
const BG = "#0a090c";
const FG = "#f7f7f9";
const PRIMARY = "#ec0e8c";
const MUTED = "#9b9aa6";
const BORDER = "rgba(255,255,255,0.12)";

const PAD = 92;
const MAX_BIO_CHARS = 80;

export interface ProfileCardUser {
  username: string;
  displayName?: string | null;
  bio?: string | null;
  question: string;
  imageUrl?: string | null;
  bannerImageUrl?: string | null;
  followerCount?: number | null;
}

export interface ProfileCardModel {
  name: string;
  handle: string;
  /** The anon-inbox prompt, rendered as a big editorial quote. */
  question: string;
  bio?: string;
  followers?: string;
  initials: string;
}

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length > max
    ? `${trimmed.slice(0, max - 1).trimEnd()}…`
    : trimmed;
}

export function profileCardModel(user: ProfileCardUser): ProfileCardModel {
  const bio = user.bio?.trim();
  const followers = user.followerCount ?? 0;
  return {
    name: user.displayName?.trim() || user.username,
    handle: `@${user.username}`,
    question: truncate(user.question, 150),
    ...(bio ? { bio: truncate(bio, MAX_BIO_CHARS) } : {}),
    ...(followers > 0
      ? {
          followers: `${new Intl.NumberFormat("en", {
            notation: "compact",
          }).format(followers)} ${followers === 1 ? "follower" : "followers"}`,
        }
      : {}),
    initials: user.username.slice(0, 2).toUpperCase(),
  };
}

/** next/font registers hashed family names — resolve the real list from the
 *  CSS vars instead of hardcoding "Bricolage Grotesque". */
function fontFamily(varName: string): string {
  const value = getComputedStyle(document.body)
    .getPropertyValue(varName)
    .trim();
  return value || "system-ui, sans-serif";
}

async function loadBitmap(
  url: string | null | undefined,
): Promise<ImageBitmap | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    return await createImageBitmap(await res.blob());
  } catch {
    return null;
  }
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Cover-fit draw (center crop), like CSS object-fit: cover. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: ImageBitmap,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  let truncated = false;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
    } else if (lines.length === maxLines - 1) {
      // The last allowed line is full — drop the remaining words.
      truncated = true;
      break;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (truncated && lines.length > 0) {
    lines[lines.length - 1] = `${lines[lines.length - 1].trimEnd()}…`;
  }
  return lines;
}

/** Same-origin raster logo via an Image element (reliable for any source). */
function loadLogo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = "/icon-192x192.png";
  });
}

export interface RenderedProfileCard {
  /** The clean image people share/save. */
  share: Blob;
  /** Same image plus the preview-only sticker guide. */
  preview: Blob;
}

export async function renderProfileCard(
  user: ProfileCardUser,
): Promise<RenderedProfileCard> {
  const model = profileCardModel(user);
  const display = fontFamily("--font-display");
  const sans = fontFamily("--font-sans");

  // All fetched in parallel; a CORS-less host just means no image — never a
  // tainted canvas, never a hard failure.
  const [banner, avatar, logo] = await Promise.all([
    loadBitmap(user.bannerImageUrl),
    loadBitmap(user.imageUrl),
    loadLogo(),
  ]);
  if (typeof document.fonts?.ready?.then === "function") {
    await document.fonts.ready;
  }

  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unavailable");
  const contentW = CARD_W - PAD * 2;

  // ── Pubmat backdrop: near-black, magenta glows, edge vignette ─────────
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const glowA = ctx.createRadialGradient(907, -154, 0, 907, -154, 1350);
  glowA.addColorStop(0, "rgba(236,14,140,0.45)");
  glowA.addColorStop(0.58, "rgba(236,14,140,0)");
  ctx.fillStyle = glowA;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const glowB = ctx.createRadialGradient(-130, 2112, 0, -130, 2112, 1200);
  glowB.addColorStop(0, "rgba(236,14,140,0.22)");
  glowB.addColorStop(0.55, "rgba(236,14,140,0)");
  ctx.fillStyle = glowB;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const vignette = ctx.createRadialGradient(540, 691, 700, 540, 691, 1500);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // ── Eyebrow pill ──────────────────────────────────────────────────────
  const eyebrow = "✦ ANONYMOUS MESSAGES";
  ctx.font = `600 26px ${sans}`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0.2em";
  const eyebrowW = ctx.measureText(eyebrow).width + 64;
  roundedRect(ctx, PAD, 170, eyebrowW, 60, 30);
  ctx.fillStyle = "rgba(236,14,140,0.12)";
  ctx.fill();
  ctx.strokeStyle = "rgba(236,14,140,0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = PRIMARY;
  ctx.fillText(eyebrow, PAD + 32, 210);
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";

  // ── Banner panel (3:1, like the profile header) ───────────────────────
  const panel = { x: PAD, y: 310, w: contentW, h: contentW / 3 };
  ctx.save();
  roundedRect(ctx, panel.x, panel.y, panel.w, panel.h, 32);
  ctx.clip();
  if (banner) {
    drawCover(ctx, banner, panel.x, panel.y, panel.w, panel.h);
    // Slight scrim so a bright banner still reads as part of the card.
    ctx.fillStyle = "rgba(10,9,12,0.18)";
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
  } else {
    ctx.fillStyle = "rgba(236,14,140,0.16)";
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
  }
  ctx.restore();
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 2;
  roundedRect(ctx, panel.x, panel.y, panel.w, panel.h, 32);
  ctx.stroke();

  // ── Avatar overlapping the panel's bottom-left (profile layout) ───────
  const avatarR = 104;
  const avatarX = PAD + 36 + avatarR;
  const avatarY = panel.y + panel.h;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarR + 12, 0, Math.PI * 2);
  ctx.fillStyle = BG;
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
  ctx.clip();
  if (avatar) {
    drawCover(
      ctx,
      avatar,
      avatarX - avatarR,
      avatarY - avatarR,
      avatarR * 2,
      avatarR * 2,
    );
  } else {
    ctx.fillStyle = "rgba(236,14,140,0.25)";
    ctx.fillRect(
      avatarX - avatarR,
      avatarY - avatarR,
      avatarR * 2,
      avatarR * 2,
    );
    ctx.fillStyle = FG;
    ctx.font = `700 84px ${sans}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(model.initials, avatarX, avatarY + 6);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();

  // ── Identity (left-aligned, editorial) ────────────────────────────────
  let cursorY = avatarY + avatarR + 110;
  ctx.fillStyle = FG;
  ctx.font = `800 80px ${display}`;
  ctx.fillText(model.name, PAD, cursorY, contentW);
  cursorY += 66;
  ctx.fillStyle = PRIMARY;
  ctx.font = `600 42px ${sans}`;
  ctx.fillText(model.handle, PAD, cursorY, contentW);

  if (model.bio) {
    ctx.fillStyle = MUTED;
    ctx.font = `400 36px ${sans}`;
    for (const line of wrapText(ctx, model.bio, contentW, 2)) {
      cursorY += 56;
      // maxWidth squish guards single unbreakable words the wrap can't split.
      ctx.fillText(line, PAD, cursorY, contentW);
    }
  }
  if (model.followers) {
    cursorY += 56;
    ctx.fillStyle = MUTED;
    ctx.font = `500 32px ${sans}`;
    ctx.fillText(model.followers, PAD, cursorY);
  }

  // ── The anon-message prompt as a big editorial quote — the product, on
  // the card. A giant magenta quote mark, the question in display type.
  // Sized to fit and centered in whatever space the identity block left
  // above the sticker slot, so short and long profiles both balance.
  const slotTop = CARD_H - 460;
  const avail = slotTop - cursorY - 70;
  // markDrop keeps the quote mark at its comfortable distance below the
  // identity block; firstLine sits the message tight beneath the mark.
  const QUOTE_SIZES = [
    { size: 60, lineH: 78, mark: 170, markDrop: 190, firstLine: 228 },
    { size: 52, lineH: 68, mark: 150, markDrop: 168, firstLine: 202 },
    { size: 44, lineH: 58, mark: 130, markDrop: 146, firstLine: 176 },
  ];
  let chosen = QUOTE_SIZES[QUOTE_SIZES.length - 1];
  let quoteLines: string[] = [];
  for (const opt of QUOTE_SIZES) {
    ctx.font = `700 ${opt.size}px ${display}`;
    const lines = wrapText(ctx, model.question, contentW - 40, 3);
    chosen = opt;
    quoteLines = lines;
    const needed = opt.firstLine + (lines.length - 1) * opt.lineH + 126;
    if (needed <= avail) break;
  }
  const blockH =
    chosen.firstLine + (quoteLines.length - 1) * chosen.lineH + 126;
  // Hug the identity block (capped offset) rather than float mid-card —
  // leftover space stays down in the sticker zone where it's actually used.
  const blockTop = cursorY + Math.min(Math.max(0, (avail - blockH) / 2), 40);
  ctx.fillStyle = PRIMARY;
  ctx.font = `800 ${chosen.mark}px ${display}`;
  ctx.fillText("“", PAD - 8, blockTop + chosen.markDrop);
  ctx.fillStyle = FG;
  ctx.font = `700 ${chosen.size}px ${display}`;
  let quoteY = blockTop + chosen.firstLine;
  for (const line of quoteLines) {
    ctx.fillText(line, PAD, quoteY, contentW);
    quoteY += chosen.lineH;
  }

  ctx.fillStyle = MUTED;
  ctx.font = `400 36px ${sans}`;
  ctx.fillText(
    "say anything — I'll never know it was you.",
    PAD,
    quoteY - chosen.lineH + 90,
    contentW,
  );

  // ── Footer: logo + domain + magenta arrow (pubmat signature). Bottom
  // inset mirrors the eyebrow's top inset and clears story UI overlays.
  const footBaseline = CARD_H - 180;
  let footX = PAD;
  if (logo) {
    ctx.save();
    roundedRect(ctx, PAD, footBaseline - 50, 62, 62, 14);
    ctx.clip();
    ctx.drawImage(logo, PAD, footBaseline - 50, 62, 62);
    ctx.restore();
    footX += 86;
  }
  ctx.fillStyle = FG;
  ctx.font = `700 48px ${display}`;
  ctx.fillText("umamin.link", footX, footBaseline);
  const domainW = ctx.measureText("umamin.link").width;
  ctx.fillStyle = PRIMARY;
  ctx.fillText("→", footX + domainW + 26, footBaseline);

  function toPng(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("png-encode-failed"))),
        "image/png",
      );
    });
  }

  // The clean image — exported BEFORE the sticker guide so a story's link
  // sticker dropped in that zone never overlaps a painted outline.
  const share = await toPng();

  // ── Link-sticker guide, PREVIEW ONLY — shows where the sticker goes
  // (the sheet has a copy-link button for it).
  const slot = { x: PAD, y: slotTop, w: contentW, h: 120 };
  ctx.save();
  ctx.setLineDash([14, 14]);
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 3;
  roundedRect(ctx, slot.x, slot.y, slot.w, slot.h, 60);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = MUTED;
  ctx.font = `500 36px ${sans}`;
  ctx.textAlign = "center";
  ctx.fillText("🔗 your link sticker goes here", CARD_W / 2, slot.y + 74);
  ctx.textAlign = "left";
  const preview = await toPng();

  return { share, preview };
}
