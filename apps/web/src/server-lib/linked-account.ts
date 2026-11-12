// Names one linked account to its owner's client without sending the Google
// subject id. The link time can't do this: it has whole-second precision, so
// two rows linked in the same second would share it. The subject id is a long
// provider-issued number and the id is only shown to that account's owner, so
// an unkeyed hash is enough.
export async function linkedAccountId(providerUserId: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`linked-account:${providerUserId}`),
  );
  return Array.from(new Uint8Array(digest).subarray(0, 16), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export const LINKED_ACCOUNT_ID_PATTERN = /^[0-9a-f]{32}$/;
