/**
 * Server-only helper for `generateMetadata` to fetch from Hono.
 *
 * Calls go directly to the Hono backend on Railway (no cookies, no rewrites),
 * so they only run at build/ISR time for static or cached metadata.
 * Avoid using this from page render — it would force the page to be dynamic
 * and incur Vercel function invocations.
 */
export function getHonoApiOrigin() {
  return (
    process.env.HONO_API_ORIGIN ??
    process.env.API_ORIGIN ??
    "http://localhost:8787"
  );
}

export async function fetchMetadataJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${getHonoApiOrigin()}${path}`, {
      headers: { accept: "application/json" },
      next: { revalidate: 300 },
    });

    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
