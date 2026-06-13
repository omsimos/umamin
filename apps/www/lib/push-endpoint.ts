// A push subscription endpoint is later used VERBATIM as an outbound request
// target by web-push (it issues an HTTPS request to whatever host/port the
// stored endpoint names). registerPushSubscriptionAction is directly callable,
// so the browser PushManager is not an enforcement boundary — validate the
// endpoint server-side or it becomes a blind-SSRF surface (an attacker could
// register an internal/metadata host under their own account).
//
// We ALLOWLIST the known push-service hosts rather than denylist private IPs: a
// denylist is bypassable via IP-encoding tricks (decimal/octal/hex literals
// that getaddrinfo still resolves to loopback, e.g. https://2130706433/). Real
// push endpoints only ever come from these few providers, so an allowlist is
// both bulletproof against SSRF and effectively complete. Add a host here if a
// new browser/push provider appears.
const ALLOWED_PUSH_HOSTS = [
  "fcm.googleapis.com", // Chrome / Edge / all Chromium browsers (FCM)
];

const ALLOWED_PUSH_HOST_SUFFIXES = [
  ".push.services.mozilla.com", // Firefox (Mozilla autopush)
  ".push.apple.com", // Safari / iOS / macOS (web.push.apple.com)
  ".notify.windows.com", // legacy Windows / EdgeHTML (WNS)
];

export function isAllowedPushEndpoint(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;
  // Reject a non-default port: web-push connects to the endpoint's port, so an
  // allowlisted host on an odd port (e.g. fcm.googleapis.com:22) would still be
  // an outbound-connection gadget. URL normalizes the default 443 away, so a
  // real endpoint leaves this empty.
  if (url.port !== "") return false;

  const host = url.hostname.toLowerCase();
  return (
    ALLOWED_PUSH_HOSTS.includes(host) ||
    ALLOWED_PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
  );
}
