import { generateVapidKeys } from "@mmmike/web-push";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isAllowedPushEndpoint, sendPush } from "../src/server-lib/push";

// Spike B (plan R3): can we build+send a Web Push request from workerd with the
// SAME base64url VAPID keypair prod stores, producing the RFC 8291 wire format?
// Build-only: @mmmike/web-push exposes send() (no request-builder), so we stub
// the global fetch to capture the outbound Request without hitting FCM/Mozilla.

const FAKE_ENDPOINT = "https://fcm.googleapis.com/fcm/send/FAKE_TOKEN_abc123";

// A subscription needs a real P-256 public key (the lib runs ECDH against it) and
// a 16-byte auth secret. Generate a throwaway client keypair to stand in for a
// browser PushManager subscription.
async function makeFakeSubscription() {
  const clientKeys = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const rawPub = new Uint8Array(
    await crypto.subtle.exportKey("raw", clientKeys.publicKey),
  );
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return {
    endpoint: FAKE_ENDPOINT,
    p256dh: b64url(rawPub),
    auth: b64url(auth),
  };
}

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

afterEach(() => vi.unstubAllGlobals());

describe("web push send in workerd (@mmmike/web-push, RFC 8291)", () => {
  it("builds a valid VAPID + aes128gcm request with a prod-format keypair", async () => {
    // generateVapidKeys() returns exactly the URL-safe base64 public/private that
    // prod stores in VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (web-push npm format).
    const { publicKey, privateKey } = await generateVapidKeys();
    expect(publicKey).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(privateKey).toMatch(/^[A-Za-z0-9_-]+$/);

    const sub = await makeFakeSubscription();

    let captured: Request | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        captured = new Request(input as string, init);
        return new Response(null, { status: 201 });
      }),
    );

    const res = await sendPush(
      sub,
      { title: "@alice liked your post", url: "/post/123", tag: "like:123" },
      {
        vapid: { publicKey, privateKey, subject: "mailto:x@umamin.link" },
        ttl: 3600,
      },
    );

    expect(res).toEqual({ ok: true });
    expect(captured).toBeDefined();
    const req = captured as Request;

    expect(req.method).toBe("POST");
    expect(req.url).toBe(FAKE_ENDPOINT);

    const auth = req.headers.get("authorization") ?? "";
    expect(auth).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[A-Za-z0-9_-]+$/);
    // The `k=` value must be the very public key prod would advertise.
    expect(auth).toContain(`k=${publicKey}`);

    expect(req.headers.get("content-encoding")).toBe("aes128gcm");
    expect(req.headers.get("ttl")).toBe("3600");

    const body = new Uint8Array(await req.arrayBuffer());
    // RFC 8291 aes128gcm: 16-byte salt + 4-byte rs + 1-byte keyid len + 65-byte
    // server key + ciphertext (>16 for the GCM tag). Not the plaintext.
    expect(body.byteLength).toBeGreaterThan(16 + 4 + 1 + 65 + 16);
    expect(body[20]).toBe(65); // keyid length octet
  });

  it("reports a 410 Gone as an expired subscription (prune signal)", async () => {
    const { publicKey, privateKey } = await generateVapidKeys();
    const sub = await makeFakeSubscription();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 410 })),
    );
    const res = await sendPush(
      sub,
      { title: "t", url: "/x", tag: "t:1" },
      { vapid: { publicKey, privateKey, subject: "mailto:x@umamin.link" } },
    );
    expect(res).toEqual({ ok: false, expired: true });
  });

  it("rejects a disallowed (SSRF) endpoint before sending", async () => {
    expect(isAllowedPushEndpoint("https://169.254.169.254/latest")).toBe(false);
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com:22/x")).toBe(
      false,
    );
    expect(isAllowedPushEndpoint("http://fcm.googleapis.com/x")).toBe(false);
    expect(isAllowedPushEndpoint(FAKE_ENDPOINT)).toBe(true);

    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { publicKey, privateKey } = await generateVapidKeys();
    await expect(
      sendPush(
        { endpoint: "https://evil.example.com/x", p256dh: "x", auth: "y" },
        { title: "t", url: "/x", tag: "t:1" },
        { vapid: { publicKey, privateKey, subject: "mailto:x@umamin.link" } },
      ),
    ).rejects.toThrow("not allowed");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
