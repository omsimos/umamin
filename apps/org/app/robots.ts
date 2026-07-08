import type { MetadataRoute } from "next";

// Invite-only product — keep the whole app (dashboard, login, and the per-org
// submit links) out of search indexes.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
