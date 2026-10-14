/**
 * Invite codes are derived from the session secret, never sent by the client.
 * Codes appear in public share links, so a client-chosen code could be claimed
 * by anyone who saw the link and used to intercept the people opening it. The
 * lobby recomputes the code from the secret in the join frame; the client
 * computes the same value to build its own link.
 */
const INVITE_CODE_LEN = 10;

export async function inviteCodeFor(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`umamin-chat-invite:${secret}`),
  );
  let n = 0n;
  for (const byte of new Uint8Array(digest).subarray(0, 8)) {
    n = (n << 8n) | BigInt(byte);
  }
  return n.toString(36).padStart(INVITE_CODE_LEN, "0").slice(-INVITE_CODE_LEN);
}
