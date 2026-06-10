import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.umamin.link";

  // lastModified intentionally omitted: it was `new Date()`, which restamped
  // every route as "just modified" on every build — a meaningless freshness
  // signal. We don't track real per-route mtimes, so we send none. /login and
  // /register are dropped (now noindex utility pages). [audit #39, #41]
  return [
    {
      url: base,
      changeFrequency: "monthly",
      priority: 1.0,
    },
    {
      url: `${base}/notes`,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${base}/feed`,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${base}/privacy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${base}/terms`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${base}/child-safety`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
