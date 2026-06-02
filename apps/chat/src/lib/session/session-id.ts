const KEY = "umamin-chat:sessionId";

// crypto.randomUUID is unavailable on insecure origins (e.g. http over a LAN IP)
// and old engines; fall back so a session id can always be produced.
function uuid(): string {
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }
  } catch {
    // fall through to the Math.random fallback
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Per-tab fallback when localStorage is unavailable (private mode / disabled /
// quota). getSessionId() runs at module load in __root.tsx, before React and
// the route error boundary mount, so an uncaught throw here white-screens the
// whole app — hence the try/catch.
let memoryId: string | null = null;

export function getSessionId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    if (!memoryId) memoryId = uuid();
    return memoryId;
  }
}
