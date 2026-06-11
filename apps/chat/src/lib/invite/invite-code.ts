const KEY = "umamin-chat:inviteCode";
const CODE_LEN = 10;
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

function randomCode(): string {
  let out = "";
  try {
    const bytes = crypto.getRandomValues(new Uint8Array(CODE_LEN));
    for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
    return out;
  } catch {
    for (let i = 0; i < CODE_LEN; i++) {
      out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    return out;
  }
}

// Per-tab fallback when localStorage is unavailable (mirrors session-id.ts).
let memoryCode: string | null = null;

/** The user's stable shareable code — the same one goes on every card they
 *  share, so an old story keeps working as long as the browser profile lives. */
export function getInviteCode(): string {
  try {
    let code = localStorage.getItem(KEY);
    if (!code) {
      code = randomCode();
      localStorage.setItem(KEY, code);
    }
    return code;
  } catch {
    memoryCode ??= randomCode();
    return memoryCode;
  }
}
