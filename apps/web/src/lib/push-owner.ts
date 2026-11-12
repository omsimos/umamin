// The account this browser's subscription was last registered to. A browser
// has one subscription whoever is signed in, so after an account switch, or a
// register that failed and couldn't be undone, the browser can hold a
// subscription the server never sends to. "" means not registered; a missing
// key means it was registered before this marker existed.
const OWNER_KEY = "umamin:push-owner";

export function readPushOwner(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

export function writePushOwner(owner: string) {
  try {
    localStorage.setItem(OWNER_KEY, owner);
  } catch {}
}
