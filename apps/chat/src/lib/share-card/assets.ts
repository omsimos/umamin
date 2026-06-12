import type { CardAssets } from "./types";

let cached: Promise<CardAssets> | null = null;

/** Same-origin logo → data: URI (so it inlines into the card SVG). Optional:
 *  on any failure the templates fall back to the text wordmark. */
export function loadCardAssets(): Promise<CardAssets> {
  cached ??= (async () => {
    try {
      const res = await fetch("/umamin-logo.svg");
      if (!res.ok) return {};
      const svg = await res.text();
      return {
        logoDataUri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
      };
    } catch {
      return {};
    }
  })();
  return cached;
}
