// A VAPID public key is an uncompressed P-256 point: 65 bytes starting 0x04,
// which base64url-encodes (unpadded) to exactly 87 characters. Anything else
// makes pushManager.subscribe() throw "applicationServerKey is not valid" for
// every visitor — which is how a key pasted twice into the build variables
// once shipped to production.
export function isValidVapidPublicKey(key: string): boolean {
  if (!/^[A-Za-z0-9_-]{87}$/.test(key)) return false;
  const bytes = atob(key.replace(/-/g, "+").replace(/_/g, "/"));
  return bytes.length === 65 && bytes.charCodeAt(0) === 0x04;
}
