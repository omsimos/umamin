import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { absoluteUrl, jsonLdScript, pageSeo } from "../src/lib/seo";
import { cleanDisplayName } from "../src/lib/utils";

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

  it("uses a page's own share image for both og and twitter", () => {
    vi.stubEnv("VITE_SITE_URL", "https://www.umamin.link");
    const { meta } = pageSeo({
      title: "t",
      description: "d",
      path: "/chat",
      image: "/chat-opengraph.png",
    });
    expect(metaValue(meta, "og:image")).toBe(
      "https://www.umamin.link/chat-opengraph.png",
    );
    expect(metaValue(meta, "twitter:image")).toBe(
      "https://www.umamin.link/chat-opengraph.png",
    );
  });

  it("declares the size and alt of whichever image the page uses", () => {
    const site = pageSeo({ title: "t", description: "d" }).meta;
    const chat = pageSeo({
      title: "t",
      description: "d",
      image: "/chat-opengraph.png",
    }).meta;
    expect(metaValue(site, "og:image:width")).toBe("1400");
    expect(metaValue(chat, "og:image:width")).toBe("2400");
    expect(metaValue(chat, "og:image:height")).toBe("1260");
    expect(metaValue(chat, "og:image:alt")).toMatch(/Umamin Chat/);
    expect(metaValue(chat, "twitter:image:alt")).toBe(
      metaValue(chat, "og:image:alt"),
    );
  });
});

describe("jsonLdScript", () => {
  it("escapes < so user text can't close the script tag", () => {
    const { children } = jsonLdScript({
      "@type": "Person",
      description: "hi</script><script>alert(1)</script>",
    });
    expect(children).not.toContain("<");
    expect(JSON.parse(children).description).toBe(
      "hi</script><script>alert(1)</script>",
    );
  });

  it("wraps a list of nodes in one @graph", () => {
    const parsed = JSON.parse(
      jsonLdScript([{ "@type": "Organization" }, { "@type": "WebSite" }])
        .children,
    );
    expect(parsed["@context"]).toBe("https://schema.org");
    expect(
      parsed["@graph"].map((n: { "@type": string }) => n["@type"]),
    ).toEqual(["Organization", "WebSite"]);
  });

  it("is only emitted by pageSeo when the page passes nodes", () => {
    expect(pageSeo({ title: "t", description: "d" }).scripts).toEqual([]);
    const { scripts } = pageSeo({
      title: "t",
      description: "d",
      jsonLd: { "@type": "AboutPage" },
    });
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.type).toBe("application/ld+json");
  });
});

describe("cleanDisplayName", () => {
  it("treats a name made of invisible marks as empty", () => {
    expect(cleanDisplayName("\u200E")).toBe("");
    expect(cleanDisplayName(" \u200B\uFEFF ")).toBe("");
  });

  it("keeps visible text and strips the marks around it", () => {
    expect(cleanDisplayName("\u200EJosh\u200F")).toBe("Josh");
    expect(cleanDisplayName(null)).toBe("");
  });
});

// Canonical/OG, robots.txt and sitemap.xml must all advertise ONE host, or
// search engines read the two hosts as duplicate content.
describe("canonical host consistency", () => {
  const root = join(import.meta.dirname, "..");
  const read = (p: string) => readFileSync(join(root, p), "utf8");

  it("robots.txt and sitemap.xml use the production canonical host", () => {
    // Cloudflare injects VITE_SITE_URL at build time, so the repository-owned
    // SEO assets are validated against the public production origin directly.
    const origin = "https://www.umamin.link";

    const robots = read("public/robots.txt");
    expect(robots).toContain(`Sitemap: ${origin}/sitemap.xml`);

    for (const loc of read("public/sitemap.xml").matchAll(
      /<loc>([^<]+)<\/loc>/g,
    )) {
      expect(new URL(loc[1]).origin).toBe(origin);
      // Canonicals are serialized URLs, so the root canonical is `origin/`.
      // A loc that differs from its serialized form never matches its page.
      expect(loc[1]).toBe(new URL(loc[1]).href);
    }
  });
});
