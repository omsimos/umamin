// Head/SEO helpers — the replacement for Next's `metadataBase` + metadata
// inheritance, which is what made every apps/www page emit ABSOLUTE og:url /
// og:image / canonical URLs. TanStack's `head()` has no such base, so URLs must
// be absolutised here: a relative og:image is unreliable for crawlers (Facebook,
// Discord, Twitter), and link previews are core to how umamin gets shared.
//
// `VITE_SITE_URL` is the canonical public origin (production: the same
// www.umamin.link host robots.txt + sitemap.xml advertise — mixing hosts across
// canonical/og/sitemap reads as duplicate content).

export const SITE_TITLE = "Umamin | Get anonymous messages with your own link";
export const SITE_DESCRIPTION =
  "Share your Umamin link and get anonymous messages from friends. Messages are encrypted before they're stored. Free and open source, made in the Philippines.";

export const OG_IMAGE = "/opengraph-image.png";
export const TWITTER_IMAGE = "/twitter-image.png";

// Every share image with its real pixel size and alt text. Pages may only pick
// from this table: the root declares og:image:width/height too, and head meta
// dedupes per property, so a page image without its own dimensions would
// inherit the root's wrong ones.
const SHARE_IMAGES = {
  [OG_IMAGE]: { width: 1400, height: 800, alt: "Umamin" },
  [TWITTER_IMAGE]: { width: 1400, height: 800, alt: "Umamin" },
  "/chat-opengraph.png": {
    width: 2400,
    height: 1260,
    alt: "Umamin Chat: anonymous conversations with unexpected people",
  },
} as const;

export type ShareImage = keyof typeof SHARE_IMAGES;

/** Cuts text to `max` characters, ending in an ellipsis when it was cut. */
export function truncate(text: string, max = 160): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

// Read per call rather than at module load: Vite still inlines the literal, and
// tests can stub the env.
function siteOrigin(): string {
  return (import.meta.env.VITE_SITE_URL ?? "").replace(/\/+$/, "");
}

/** Absolutise an app path against the canonical origin (pass-through if already absolute). */
export function absoluteUrl(path: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return path;
  const origin = siteOrigin();
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return origin ? `${origin}${suffix}` : suffix;
}

type MetaTag = Record<string, string>;

export type JsonLd = Record<string, unknown>;

type HeadScript = { type: string; children: string };

type PageSeoInput = {
  title: string;
  description: string;
  /** App path for the self-referential canonical + og:url. Omit for pages that shouldn't advertise one. */
  path?: string;
  ogType?: "website" | "article" | "profile";
  /** `summary_large_image` also emits twitter:image; `summary` lets crawlers fall back to og:image. */
  twitterCard?: "summary" | "summary_large_image";
  /** e.g. "noindex, follow". Omitted → inherits the root's index,follow default. */
  robots?: string;
  /** A page-specific share image, used for og:image and twitter:image.
   *  Omitted → the site-wide images. */
  image?: ShareImage;
  /** Schema.org nodes, emitted as one JSON-LD script. */
  jsonLd?: JsonLd | JsonLd[];
};

/**
 * One page's `head()` payload: title/description, the OG + Twitter card, and a
 * self-referential canonical. Every URL comes out absolute.
 *
 * og:image is re-declared on every page ON PURPOSE — head meta is deduped by
 * name/property with the deepest route winning, so a page that declares its own
 * og:* set must also name the image or the preview loses it (MEMORY:
 * og-image-shallow-merge).
 */
export function pageSeo({
  title,
  description,
  path,
  ogType = "website",
  twitterCard = "summary_large_image",
  robots,
  image,
  jsonLd,
}: PageSeoInput): {
  meta: MetaTag[];
  links: { rel: string; href: string }[];
  scripts: HeadScript[];
} {
  const meta: MetaTag[] = [
    { title },
    { name: "description", content: description },
  ];

  if (robots) meta.push({ name: "robots", content: robots });

  meta.push(
    { property: "og:type", content: ogType },
    { property: "og:site_name", content: "Umamin" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
  );
  const og = image ?? OG_IMAGE;
  meta.push(
    { property: "og:image", content: absoluteUrl(og) },
    { property: "og:image:width", content: String(SHARE_IMAGES[og].width) },
    { property: "og:image:height", content: String(SHARE_IMAGES[og].height) },
    { property: "og:image:alt", content: SHARE_IMAGES[og].alt },
  );
  if (path) meta.push({ property: "og:url", content: absoluteUrl(path) });

  meta.push(
    { name: "twitter:card", content: twitterCard },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  );
  if (twitterCard === "summary_large_image") {
    const tw = image ?? TWITTER_IMAGE;
    meta.push(
      { name: "twitter:image", content: absoluteUrl(tw) },
      { name: "twitter:image:alt", content: SHARE_IMAGES[tw].alt },
    );
  }

  return {
    meta,
    // Canonical is per-page only: links are concatenated (not deduped by rel),
    // so a root-level canonical would stack a second one on every route.
    links: path ? [{ rel: "canonical", href: absoluteUrl(path) }] : [],
    scripts: jsonLd ? [jsonLdScript(jsonLd)] : [],
  };
}

/**
 * A JSON-LD `<script>` for `head().scripts`. Bios and post text are user input,
 * so `<` is escaped: a literal `</script>` in them would otherwise close the tag.
 */
export function jsonLdScript(data: JsonLd | JsonLd[]): HeadScript {
  const body = Array.isArray(data)
    ? { "@context": "https://schema.org", "@graph": data }
    : { "@context": "https://schema.org", ...data };
  return {
    type: "application/ld+json",
    children: JSON.stringify(body).replace(/</g, "\\u003c"),
  };
}

// Stable @ids let every page point at the same Organization and WebSite nodes
// instead of each one describing a separate publisher.
export const orgId = () => absoluteUrl("/#organization");
export const websiteId = () => absoluteUrl("/#website");

/** A reference to the site's Organization node, for publisher/about fields. */
export function orgRef(): JsonLd {
  return {
    "@type": "Organization",
    "@id": orgId(),
    name: "Umamin",
    url: absoluteUrl("/"),
  };
}

/** Organization, WebSite and WebApplication nodes for the homepage. */
export function siteGraph(description: string): JsonLd[] {
  return [
    {
      ...orgRef(),
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/icon-512x512.png"),
        width: 512,
        height: 512,
      },
      description,
      foundingDate: "2022-07",
      foundingLocation: { "@type": "Place", name: "Philippines" },
      parentOrganization: {
        "@type": "Organization",
        name: "Omsimos Collective",
        url: "https://github.com/omsimos",
      },
      sameAs: ["https://github.com/omsimos/umamin"],
    },
    {
      "@type": "WebSite",
      "@id": websiteId(),
      name: "Umamin",
      url: absoluteUrl("/"),
      description,
      inLanguage: "en",
      publisher: { "@id": orgId() },
    },
    {
      "@type": "WebApplication",
      name: "Umamin",
      url: absoluteUrl("/"),
      applicationCategory: "SocialNetworkingApplication",
      operatingSystem: "Web",
      browserRequirements: "Requires JavaScript",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@id": orgId() },
    },
  ];
}

// iOS standalone launch screens (portrait — the manifest locks orientation),
// ported from apps/www's appleWebApp.startupImage. Generated by
// store-assets/splash-gen.py; without these links the installed iOS PWA opens on
// a blank white screen.
const APPLE_SPLASH: Array<[width: number, height: number, ratio: number]> = [
  [375, 667, 2],
  [414, 736, 3],
  [375, 812, 3],
  [414, 896, 2],
  [414, 896, 3],
  [390, 844, 3],
  [428, 926, 3],
  [393, 852, 3],
  [430, 932, 3],
  [402, 874, 3],
  [440, 956, 3],
  [420, 912, 3],
  [768, 1024, 2],
  [820, 1180, 2],
  [834, 1194, 2],
  [1024, 1366, 2],
];

export const appleSplashLinks = APPLE_SPLASH.map(([width, height, ratio]) => ({
  rel: "apple-touch-startup-image",
  href: `/splash/apple-splash-${width * ratio}-${height * ratio}.png`,
  media: `screen and (device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`,
}));
