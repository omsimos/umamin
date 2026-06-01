export type LinkRisk = "shortener" | "insecure" | "ip" | "punycode";

export type ExternalUrlInfo = {
  hostname: string;
  risks: LinkRisk[];
};

export const RISK_LABELS: Record<LinkRisk, string> = {
  shortener: "Shortened link — the real destination is hidden",
  insecure: "Not a secure (HTTPS) connection",
  ip: "Points to a raw IP address instead of a domain",
  punycode: "Look-alike characters that can mimic a real site",
};

// Common URL shorteners — the displayed link hides the true destination behind
// a redirect, so we surface it as a risk worth a second look.
const SHORTENERS = new Set([
  "bit.ly",
  "t.co",
  "tinyurl.com",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "rebrand.ly",
  "cutt.ly",
  "shorturl.at",
  "rb.gy",
  "t.ly",
  "tiny.cc",
  "s.id",
  "lnkd.in",
  "trib.al",
  "shar.es",
  "db.tt",
  "v.gd",
  "clck.ru",
]);

const IPV4_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/;

// Inspects an external URL for cheap, client-side risk signals. Returns null
// only when the string isn't a parseable URL (the caller still warns generically
// in that case). No network calls — purely heuristic.
export function analyzeExternalUrl(href: string): ExternalUrlInfo | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase();
  const risks: LinkRisk[] = [];

  if (url.protocol !== "https:") risks.push("insecure");
  // url.hostname is bracketless for IPv6 but keeps the colons, so a colon (or a
  // dotted-quad) means a raw IP rather than a domain name.
  if (IPV4_RE.test(hostname) || hostname.includes(":")) risks.push("ip");
  if (hostname.split(".").some((part) => part.startsWith("xn--"))) {
    risks.push("punycode");
  }
  if (SHORTENERS.has(hostname.replace(/^www\./, ""))) risks.push("shortener");

  return { hostname, risks };
}
