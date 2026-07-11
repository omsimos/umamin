import "server-only";

export function publicJson(
  body: unknown,
  maxAgeSeconds: number,
  init?: ResponseInit & {
    headers?: HeadersInit;
    // Browser TTL. Defaults to 0 so a reload still revalidates against the edge
    // (the live default — e.g. the chat-head poll). Set it (> 0) for non-live
    // public data so a reload inside the window is served from the browser's own
    // cache and never becomes an Edge Request at all.
    browserMaxAgeSeconds?: number;
  },
) {
  const { browserMaxAgeSeconds = 0, ...responseInit } = init ?? {};
  const headers = new Headers(responseInit.headers);

  // Single header, split by directive: `max-age` is the browser TTL Vercel
  // forwards to the client; `s-maxage`/SWR are consumed at the edge (Vercel
  // strips them before the client sees the header) and set the CDN TTL. So a
  // reload within `max-age` avoids the edge entirely, while many clients still
  // collapse to one origin hit within `s-maxage`.
  headers.set(
    "Cache-Control",
    `public, max-age=${browserMaxAgeSeconds}, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds}`,
  );

  return Response.json(body, {
    ...responseInit,
    headers,
  });
}
