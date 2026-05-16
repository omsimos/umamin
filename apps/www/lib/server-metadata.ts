/**
 * Server-only helper for `generateMetadata` to fetch from Hono.
 *
 * Calls go directly to the Hono backend on Railway (no cookies, no rewrites),
 * so they only run at build/ISR time for static or cached metadata.
 * Avoid using this from page render — it would force the page to be dynamic
 * and incur Vercel function invocations.
 *
 * Returns null in production when no origin env var is configured, so callers
 * can bail gracefully (e.g. during a Vercel build without HONO_API_ORIGIN set)
 * rather than crash on a localhost connect refused.
 */
export function getHonoApiOrigin(): string | null {
  const configured = process.env.HONO_API_ORIGIN ?? process.env.API_ORIGIN;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") return null;
  return "http://localhost:8787";
}

export async function fetchMetadataJson<T>(path: string): Promise<T | null> {
  const origin = getHonoApiOrigin();
  if (!origin) return null;

  try {
    const response = await fetch(`${origin}${path}`, {
      headers: { accept: "application/json" },
      next: { revalidate: 300 },
    });

    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
