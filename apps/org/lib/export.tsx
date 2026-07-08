import JSZip from "jszip";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { ShareCard } from "@/components/share-card";
import type { ExportTheme } from "@/lib/export-themes";
import type { OrgMessageItem } from "@/lib/query-types";

// Only the username is needed (export filenames).
export type ExportOrg = { username: string };

const CARD_WIDTH = 540;

// Umamin mark stamped on the bottom-right of every export (copied from
// apps/www/public). Loaded once per session; best-effort — a load failure
// must never break a save, so it resolves to null instead of throwing.
let logoPromise: Promise<HTMLImageElement | null> | null = null;
function loadWatermark(): Promise<HTMLImageElement | null> {
  logoPromise ??= (async () => {
    try {
      const img = new Image();
      img.src = "/icon-512x512.png";
      await img.decode();
      return img;
    } catch {
      return null;
    }
  })();
  return logoPromise;
}

// Ported from apps/www lib/utils.ts padForSharing: a uniform 5% inset margin,
// and landscape cards grown to 1:1 so the export is social-ready. Returns the
// original on any failure so a save never breaks over framing.
async function padForSharing(
  dataUrl: string,
  canvasBg: string,
): Promise<string> {
  try {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();

    const { width: w, height: h } = img;
    const margin = Math.round(Math.max(w, h) * 0.05);
    const canvasW = w + margin * 2;
    const canvasH = Math.max(h + margin * 2, canvasW);

    const canvas = document.createElement("canvas");
    canvas.width = canvasW;
    canvas.height = canvasH;

    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;

    ctx.fillStyle = canvasBg;
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.drawImage(
      img,
      Math.round((canvasW - w) / 2),
      Math.round((canvasH - h) / 2),
    );

    // Watermark: rounded-corner logo in the bottom-right margin.
    const logo = await loadWatermark();
    if (logo) {
      const size = Math.round(canvasW * 0.065);
      const pad = Math.round(canvasW * 0.025);
      const x = canvasW - size - pad;
      const y = canvasH - size - pad;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, size, size, Math.round(size * 0.22));
      ctx.clip();
      ctx.drawImage(logo, x, y, size, size);
      ctx.restore();
    }

    return canvas.toDataURL("image/png");
  } catch (err) {
    console.error(err);
    return dataUrl;
  }
}

// Mount a ShareCard off-screen and rasterize it. The host must NOT use
// visibility:hidden (or display:none) — domToPng clones COMPUTED styles, so a
// hidden host produces a blank capture; off-viewport positioning alone keeps
// the node painted without flashing on screen.
async function rasterizeCard(
  message: OrgMessageItem,
  theme: ExportTheme,
): Promise<string> {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-99999px";
  host.style.top = "0";
  host.style.width = `${CARD_WIDTH}px`;
  host.style.pointerEvents = "none";
  document.body.appendChild(host);

  const root = createRoot(host);
  // React 19 commits async — a fixed frame count can elapse before the commit
  // (seen when the first export also pays the on-demand chunk compile), leaving
  // firstElementChild null. flushSync forces the commit before we proceed.
  flushSync(() => {
    root.render(createElement(ShareCard, { message, theme }));
  });
  // One frame for layout/paint, then fonts, or text rasterizes with fallback
  // metrics.
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
  await document.fonts.ready;

  try {
    const target = host.firstElementChild as HTMLElement | null;
    if (!target) throw new Error("ShareCard did not render");
    const { domToPng } = await import("modern-screenshot");
    const raw = await domToPng(target, {
      quality: 1,
      scale: 4,
      backgroundColor: theme.canvas,
      filter: (node) =>
        !(node instanceof Element && node.hasAttribute("data-export-exclude")),
      // Same framing as www's message export: shrink slightly so the export
      // background forms an inner border around the card.
      style: { scale: "0.9", display: "grid", placeItems: "center" },
    });
    return await padForSharing(raw, theme.canvas);
  } finally {
    root.unmount();
    host.remove();
  }
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function downloadCardImage(
  message: OrgMessageItem,
  org: ExportOrg,
  theme: ExportTheme,
): Promise<void> {
  const dataUrl = await rasterizeCard(message, theme);
  triggerDownload(dataUrl, `${org.username}-${message.id}.png`);
}

// Render each message to a branded PNG and bundle into one ZIP. Never uses
// navigator.share (one gesture per file) — always a single blob download.
export async function exportMessagesAsZip(
  messages: OrgMessageItem[],
  org: ExportOrg,
  theme: ExportTheme,
  onProgress?: (done: number, total: number) => void,
): Promise<{ ok: number; failed: number }> {
  const zip = new JSZip();
  let ok = 0;
  let failed = 0;

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (!m) continue;
    try {
      const dataUrl = await rasterizeCard(m, theme);
      const name = `${String(i + 1).padStart(3, "0")}-${m.id}.png`;
      zip.file(name, dataUrlToBytes(dataUrl));
      ok++;
    } catch (err) {
      console.error("export card failed", err);
      failed++;
    }
    onProgress?.(i + 1, messages.length);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  try {
    triggerDownload(url, `${org.username}-messages.zip`);
  } finally {
    URL.revokeObjectURL(url);
  }

  return { ok, failed };
}
