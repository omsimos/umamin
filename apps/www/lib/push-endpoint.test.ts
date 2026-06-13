import { describe, expect, it } from "vitest";
import { isAllowedPushEndpoint } from "./push-endpoint";

describe("isAllowedPushEndpoint", () => {
  it("allows the known push-service https endpoints", () => {
    expect(
      isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc123"),
    ).toBe(true);
    expect(
      isAllowedPushEndpoint(
        "https://updates.push.services.mozilla.com/wpush/v2/xyz",
      ),
    ).toBe(true);
    expect(isAllowedPushEndpoint("https://web.push.apple.com/q/p/abc")).toBe(
      true,
    );
    expect(
      isAllowedPushEndpoint("https://abc.notify.windows.com/w/?token=x"),
    ).toBe(true);
  });

  it("rejects non-https schemes", () => {
    expect(isAllowedPushEndpoint("http://fcm.googleapis.com/x")).toBe(false);
    expect(isAllowedPushEndpoint("file:///etc/passwd")).toBe(false);
    expect(isAllowedPushEndpoint("ftp://fcm.googleapis.com/x")).toBe(false);
    expect(isAllowedPushEndpoint("javascript:alert(1)")).toBe(false);
    expect(isAllowedPushEndpoint("data:text/plain,hi")).toBe(false);
    expect(isAllowedPushEndpoint("not a url")).toBe(false);
  });

  it("rejects an allowlisted host on a non-default port (connect-target gadget)", () => {
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com:1337/x")).toBe(
      false,
    );
    expect(isAllowedPushEndpoint("https://web.push.apple.com:22/x")).toBe(
      false,
    );
    // An explicit :443 normalizes away and is still allowed.
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com:443/x")).toBe(
      true,
    );
  });

  it("rejects internal/private hosts and IP literals (SSRF targets)", () => {
    expect(isAllowedPushEndpoint("https://localhost/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://127.0.0.1/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://10.0.0.1/admin")).toBe(false);
    expect(
      isAllowedPushEndpoint("https://169.254.169.254/latest/meta-data"),
    ).toBe(false);
    expect(isAllowedPushEndpoint("https://[::1]:8080/x")).toBe(false);
  });

  it("rejects IP-encoding bypasses that resolve to loopback", () => {
    // Decimal / hex / octal forms of 127.0.0.1 that getaddrinfo still resolves —
    // the allowlist closes these by construction (none are an allowed host).
    expect(isAllowedPushEndpoint("https://2130706433/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://0x7f000001/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://0177.0.0.1/x")).toBe(false);
  });

  it("rejects arbitrary public hosts and lookalikes (not on the allowlist)", () => {
    expect(isAllowedPushEndpoint("https://8.8.8.8/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://evil.example.com/x")).toBe(false);
    // Lookalikes must not slip past the exact-host / dotted-suffix checks.
    expect(isAllowedPushEndpoint("https://evilfcm.googleapis.com/x")).toBe(
      false,
    );
    expect(isAllowedPushEndpoint("https://notpush.apple.com/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com.evil.com/x")).toBe(
      false,
    );
  });
});
