import "server-only";

import { cookies, headers } from "next/headers";

function getApiOrigin() {
  return (
    process.env.HONO_API_ORIGIN ??
    process.env.API_ORIGIN ??
    "http://localhost:8787"
  );
}

function splitSetCookie(value: string) {
  return value.split(/,\s*(?=[^;,]+=)/g);
}

async function forwardSetCookie(response: Response) {
  const cookieStore = await cookies();
  const headersWithGetSetCookie = response.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const values =
    headersWithGetSetCookie.getSetCookie?.() ??
    (response.headers.get("set-cookie")
      ? splitSetCookie(response.headers.get("set-cookie") ?? "")
      : []);

  for (const value of values) {
    const [pair, ...attributes] = value.split(";").map((part) => part.trim());
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;

    const name = pair.slice(0, separator);
    const cookieValue = pair.slice(separator + 1);
    const options: Parameters<typeof cookieStore.set>[2] = { path: "/" };

    for (const attr of attributes) {
      const [rawKey, rawValue] = attr.split("=");
      const key = rawKey.toLowerCase();
      if (key === "httponly") options.httpOnly = true;
      if (key === "secure") options.secure = true;
      if (key === "samesite")
        options.sameSite = rawValue?.toLowerCase() as "lax";
      if (key === "path") options.path = rawValue;
      if (key === "max-age") options.maxAge = Number(rawValue);
      if (key === "expires") options.expires = new Date(rawValue);
    }

    cookieStore.set(name, cookieValue, options);
  }
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const requestHeaders = new Headers(init.headers);
  const incomingHeaders = await headers();
  const cookie = incomingHeaders.get("cookie");

  if (cookie && !requestHeaders.has("cookie")) {
    requestHeaders.set("cookie", cookie);
  }

  if (init.body && !requestHeaders.has("content-type")) {
    requestHeaders.set("content-type", "application/json");
  }

  const response = await fetch(`${getApiOrigin()}${path}`, {
    ...init,
    headers: requestHeaders,
    cache: "no-store",
  });

  await forwardSetCookie(response);
  return response;
}

// biome-ignore lint/suspicious/noExplicitAny: Preserves existing server-action result inference for UI call sites that access dynamic response keys.
export async function apiJson<T = any>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await apiFetch(path, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string | { message?: string };
    } | null;
    const message =
      typeof body?.error === "string"
        ? body.error
        : (body?.error?.message ?? "Request failed");
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export function jsonBody(value: unknown) {
  return JSON.stringify(value);
}
