import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = "https://www.umamin.link";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/*", "/auth/*", "/inbox/*", "/settings/*"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
