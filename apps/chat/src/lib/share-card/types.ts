/** A text drawing op executed with canvas fillText over the rasterized SVG.
 *  Text lives here (not in the SVG) because an SVG loaded as an image renders
 *  sandboxed — it can't see the document's loaded fonts. */
export interface TextOp {
  text: string;
  x: number;
  y: number;
  /** Full CSS font shorthand, e.g. `700 72px "Bricolage Grotesque Variable"`. */
  font: string;
  fill: string;
  align?: CanvasTextAlign;
  /** Canvas-native squish — cheap truncation guard for long aliases. */
  maxWidth?: number;
  /** e.g. "0.2em" for the eyebrow pills; ignored where unsupported. */
  letterSpacing?: string;
}

export interface CardRender {
  /** Root MUST carry explicit width/height attributes (WebKit rasterization). */
  svg: string;
  texts: TextOp[];
  width: number;
  height: number;
  /** Preview-only overlay (e.g. the link-sticker guide): drawn on the preview
   *  image but never on the shared/saved one. Full SVG document. */
  previewSvg?: string;
  previewTexts?: TextOp[];
}

export interface ReceiptExtra {
  label: string;
  value: string;
}

/** Stats-only input — the receipt structurally cannot contain message text. */
export interface ChatReceiptStats {
  matchId: string;
  self: { alias: string; avatarSeed: string };
  partner: { alias: string; avatarSeed: string };
  /** Interest ids, resolved to labels via interestById. */
  sharedInterests: string[];
  /** Absent => the duration line is omitted. */
  durationMs?: number;
  messageCount?: number;
  /** The message window was capped — render "100+". */
  messageCountCapped?: boolean;
  reactionCount?: number;
  endedAt: number;
  /** Extra receipt lines (e.g. the mini-game score). */
  extras?: ReceiptExtra[];
}

// URLs are never painted on cards (an image isn't tappable) — the card
// carries a link-sticker placeholder and the share sheet a copy-link button.
export interface InviteCardInput {
  alias: string;
  avatarSeed: string;
  /** The sharer's picked interest ids — rendered as pubmat-style chips. */
  interests?: string[];
}

export interface CardAssets {
  /** Brand logo as a data: URI; absent => text wordmark only. */
  logoDataUri?: string;
}
