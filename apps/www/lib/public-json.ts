import "server-only";

export function publicJson(
  body: unknown,
  maxAgeSeconds: number,
  init?: ResponseInit & { headers?: HeadersInit },
) {
  const headers = new Headers(init?.headers);

  headers.set(
    "Cache-Control",
    `public, max-age=0, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds}`,
  );

  return Response.json(body, {
    ...init,
    headers,
  });
}
