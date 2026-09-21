import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { THEME_COLOR } from "@/components/theme-color";
import { appleSplashLinks } from "@/lib/seo";

// The installable surface is a set of files that reference each other by
// path and nothing type-checks the links: a renamed icon breaks install
// silently, a missing precache entry aborts the service worker install, and a
// mis-sized launch image is ignored by iOS without a word.
const ROOT = join(import.meta.dirname, "..");
const PUBLIC = join(ROOT, "public");

const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const publicFileExists = (url: string) => existsSync(join(PUBLIC, url));

const manifest = JSON.parse(read("public/manifest.webmanifest")) as {
  start_url: string;
  theme_color: string;
  background_color: string;
  icons: Array<{ src: string; sizes: string; purpose?: string }>;
  shortcuts: Array<{ url: string; icons: Array<{ src: string }> }>;
  screenshots: Array<{ src: string; sizes: string }>;
};

// PNG IHDR: width and height are the two big-endian u32s after the 16-byte
// signature + chunk header.
function pngSize(path: string): [number, number] {
  const buf = readFileSync(path);
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

describe("web app manifest", () => {
  it("points every icon, shortcut icon and screenshot at a real file", () => {
    const srcs = [
      ...manifest.icons.map((i) => i.src),
      ...manifest.shortcuts.flatMap((s) => s.icons.map((i) => i.src)),
      ...manifest.screenshots.map((s) => s.src),
    ];
    expect(srcs.length).toBeGreaterThan(0);
    expect(srcs.filter((src) => !publicFileExists(src))).toEqual([]);
  });

  it("declares icon and screenshot sizes that match the PNG headers", () => {
    for (const asset of [...manifest.icons, ...manifest.screenshots]) {
      const [w, h] = pngSize(join(PUBLIC, asset.src));
      expect(`${asset.src} ${w}x${h}`).toBe(`${asset.src} ${asset.sizes}`);
    }
  });

  it("routes every shortcut to a registered path", () => {
    const routeTree = read("src/routeTree.gen.ts");
    for (const { url } of manifest.shortcuts) {
      expect(routeTree, `no route for shortcut ${url}`).toContain(`'${url}'`);
    }
  });

  it("uses the app's dark background for the splash and chrome tint", () => {
    // A different value shows as a seam between the OS splash / status bar
    // and the first paint; the iOS launch images are generated from the same
    // token (store-assets/splash-gen.py).
    expect(manifest.theme_color).toBe(THEME_COLOR.dark);
    expect(manifest.background_color).toBe(THEME_COLOR.dark);
  });
});

describe("service worker", () => {
  const sw = read("public/sw.js");

  it("precaches only files that exist (a missing one aborts install)", () => {
    const list = sw.match(/const PRECACHE_URLS = \[([^\]]+)\]/)?.[1];
    expect(list).toBeTruthy();
    const urls = [...(list ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    // The named OFFLINE_URL constant is spliced in by reference.
    const offline = sw.match(/const OFFLINE_URL = "([^"]+)"/)?.[1];
    expect(offline).toBeTruthy();
    const all = [offline as string, ...urls];
    expect(all.filter((u) => !publicFileExists(u))).toEqual([]);
  });

  it("treats the manifest start_url as a dynamic navigation", () => {
    // Otherwise an offline launch of the installed app would be served the
    // browser's error page instead of offline.html.
    const prefixes = sw.match(
      /const DYNAMIC_NAVIGATION_PREFIXES = \[([^\]]+)\]/,
    )?.[1];
    const list = [...(prefixes ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(
      list.some(
        (p) =>
          manifest.start_url === p || manifest.start_url.startsWith(`${p}/`),
      ),
    ).toBe(true);
  });
});

describe("iOS launch images", () => {
  it("ships a correctly sized PNG for every declared device", () => {
    expect(appleSplashLinks.length).toBeGreaterThan(0);
    for (const link of appleSplashLinks) {
      const file = join(PUBLIC, link.href);
      expect(existsSync(file), `missing ${link.href}`).toBe(true);
      const [w, h] = pngSize(file);
      expect(`${link.href} ${w}x${h}`).toBe(
        `${link.href} ${link.href
          .match(/(\d+)-(\d+)\.png$/)
          ?.slice(1)
          .join("x")}`,
      );
    }
  });
});
