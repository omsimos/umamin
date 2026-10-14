const KEY = "umamin-chat:sessionId";
const SECRET_KEY = "umamin-chat:sessionSecret";

export interface SessionCredentials {
  sessionId: string;
  sessionSecret: string;
}

// crypto.randomUUID is unavailable on insecure origins (e.g. http over a LAN IP)
// and old engines; fall back so a session id can always be produced. Exported
// for per-tab presence ids, which need the same fallbacks.
export function uuid(): string {
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }
  } catch {}
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.getRandomValues === "function"
    ) {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0"));
      return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
        .slice(6, 8)
        .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
    }
  } catch {}
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Per-tab fallback when localStorage is unavailable (private mode / disabled /
// quota). getSessionCredentials() runs at module load in __root.tsx, before
// React and the route error boundary mount, so an uncaught throw here
// white-screens the whole app — hence the try/catch.
let memoryId: string | null = null;
let memorySecret: string | null = null;

export function getSessionCredentials(): SessionCredentials {
  try {
    let sessionId = localStorage.getItem(KEY);
    let sessionSecret = localStorage.getItem(SECRET_KEY);
    if (!sessionId) {
      sessionId = uuid();
      localStorage.setItem(KEY, sessionId);
    }
    if (!sessionSecret) {
      sessionSecret = uuid();
      localStorage.setItem(SECRET_KEY, sessionSecret);
    }
    return { sessionId, sessionSecret };
  } catch {
    if (!memoryId) memoryId = uuid();
    if (!memorySecret) memorySecret = uuid();
    return { sessionId: memoryId, sessionSecret: memorySecret };
  }
}
