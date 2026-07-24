// Pure client-IP extraction + canonicalization, shared by the Hono middleware
// and the read/action layers. No platform imports so any bundle can use it.
//
// On Cloudflare the trustworthy source is `CF-Connecting-IP` — set by the edge
// and NOT client-spoofable — so it takes priority. The Vercel-era headers are
// kept as fallbacks for the staging/parity window (requests proxied through the
// old stack) and local dev; the left-most `x-forwarded-for` entry is a
// last-resort fallback (a client can prepend it). A constant covers local dev.
export function extractClientIp(
  get: (name: string) => string | null | undefined,
): string {
  const ip =
    get("cf-connecting-ip")?.trim() ||
    get("x-real-ip")?.trim() ||
    get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    get("x-forwarded-for")?.split(",")[0]?.trim();
  return ip || "127.0.0.1";
}

// Canonicalize an IP so equivalent representations compare equal — required for
// the denylist (exact-string membership). IPv4 (and any string without a colon)
// is just lowercased/trimmed. IPv6 is expanded to its full 8-group, zero-padded,
// lowercase form so "2001:DB8::1", "2001:db8::1", and the fully-written form all
// collapse to one key. Malformed input falls back to the trimmed lowercase
// string (so an unparseable value still stores/compares consistently).
export function canonicalizeIp(ip: string): string {
  const trimmed = ip.trim().toLowerCase();
  if (!trimmed.includes(":")) return trimmed;

  // Drop a zone id (e.g. fe80::1%eth0) before parsing.
  let addr = trimmed.split("%")[0];

  // Convert a trailing dotted-quad (IPv4-mapped, e.g. ::ffff:1.2.3.4) to two
  // hextets so the whole address is hex.
  const lastColon = addr.lastIndexOf(":");
  const tail = addr.slice(lastColon + 1);
  if (tail.includes(".")) {
    const q = tail.split(".").map((p) => Number(p));
    if (
      q.length === 4 &&
      q.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)
    ) {
      const hi = ((q[0] << 8) | q[1]).toString(16);
      const lo = ((q[2] << 8) | q[3]).toString(16);
      addr = `${addr.slice(0, lastColon + 1)}${hi}:${lo}`;
    }
  }

  const [head, rest] = addr.split("::");
  const headGroups = head ? head.split(":") : [];
  let groups: string[];
  if (rest === undefined) {
    groups = headGroups;
  } else {
    const tailGroups = rest ? rest.split(":") : [];
    const missing = 8 - headGroups.length - tailGroups.length;
    if (missing < 0) return trimmed;
    groups = [...headGroups, ...Array(missing).fill("0"), ...tailGroups];
  }

  if (groups.length !== 8) return trimmed;
  return groups.map((g) => g.padStart(4, "0")).join(":");
}
