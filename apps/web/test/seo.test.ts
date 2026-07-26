import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { absoluteUrl, pageSeo } from "../src/lib/seo";

afterEach(() => {
  vi.unstubAllEnvs();
});

function metaValue(
  meta: Array<Record<string, string>>,
  key: string,
): string | undefined {
  return meta.find((tag) => tag.name === key || tag.property === key)?.content;
}

describe("absoluteUrl", () => {
  it("prefixes the canonical origin", () => {
    vi.stubEnv("VITE_SITE_URL", "https://www.umamin.link");
    expect(absoluteUrl("/user/josh")).toBe("https://www.umamin.link/user/josh");
  });

  it("tolerates a trailing slash on the configured origin", () => {
    vi.stubEnv("VITE_SITE_URL", "https://www.umamin.link/");
    expect(absoluteUrl("/feed")).toBe("https://www.umamin.link/feed");
  });

  it("passes absolute URLs through untouched", () => {
    vi.stubEnv("VITE_SITE_URL", "https://www.umamin.link");
    expect(absoluteUrl("https://chat.umamin.link")).toBe(
      "https://chat.umamin.link",
    );
  });
});

describe("pageSeo", () => {
  it("emits absolute og:url, og:image and canonical", () => {
    vi.stubEnv("VITE_SITE_URL", "https://www.umamin.link");
    const { meta, links } = pageSeo({
      title: "t",
      description: "d",
      path: "/post/abc",
      ogType: "article",
      twitterCard: "summary",
    });

    expect(metaValue(meta, "og:url")).toBe("https://www.umamin.link/post/abc");
    expect(metaValue(meta, "og:image")).toBe(
      "https://www.umamin.link/opengraph-image.png",
    );
    expect(metaValue(meta, "og:type")).toBe("article");
    expect(links).toEqual([
      { rel: "canonical", href: "https://www.umamin.link/post/abc" },
    ]);
    // `summary` cards fall back to og:image rather than the wide twitter asset.
    expect(metaValue(meta, "twitter:image")).toBeUndefined();
  });

  it("omits the canonical when no path is given (private/utility pages)", () => {
    const { links, meta } = pageSeo({
      title: "t",
      description: "d",
      robots: "noindex, nofollow",
    });
    expect(links).toEqual([]);
    expect(metaValue(meta, "robots")).toBe("noindex, nofollow");
    expect(metaValue(meta, "og:url")).toBeUndefined();
  });

  it("always names og:image so a page-level OG set can't drop it", () => {
    const { meta } = pageSeo({ title: "t", description: "d", path: "/" });
    expect(metaValue(meta, "og:image")).toContain("/opengraph-image.png");
    expect(metaValue(meta, "twitter:image")).toContain("/twitter-image.png");
  });
});

// Canonical/OG, robots.txt and sitemap.xml must all advertise ONE host, or
// search engines read the two hosts as duplicate content.
describe("canonical host consistency", () => {
  const root = join(import.meta.dirname, "..");
  const read = (p: string) => readFileSync(join(root, p), "utf8");

  it("VITE_SITE_URL matches the host in robots.txt and sitemap.xml", () => {
    const configured =
      read(".env.production").match(/^VITE_SITE_URL=(.+)$/m)?.[1];
    expect(configured).toBeTruthy();
    const origin = new URL(configured as string).origin;

    const robots = read("public/robots.txt");
    expect(robots).toContain(`Sitemap: ${origin}/sitemap.xml`);
    expect(robots).toContain(`Host: ${origin}`);

    for (const loc of read("public/sitemap.xml").matchAll(
      /<loc>([^<]+)<\/loc>/g,
    )) {
      expect(new URL(loc[1]).origin).toBe(origin);
    }
  });
});
