import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getExistingSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from "./push-client";

// A 65-byte uncompressed P-256 point, which is all the lib checks.
const VAPID_KEY = Buffer.from([4, ...Array.from({ length: 64 }, () => 1)])
  .toString("base64url")
  .replace(/=+$/, "");

const NEVER = new Promise<never>(() => {});
const TIMED_OUT = Symbol("timed out");

// `serviceWorker.ready` never settles without a registration, so a hang here
// is the bug; fail fast instead of waiting for the test timeout.
function settle<T>(promise: Promise<T>) {
  return Promise.race([
    promise,
    new Promise<typeof TIMED_OUT>((resolve) =>
      setTimeout(() => resolve(TIMED_OUT), 200),
    ),
  ]);
}

function stubServiceWorker(registration: unknown) {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      ready: NEVER,
      getRegistration: vi.fn(async () => registration),
    },
  });
}

describe("push-client without a ready service worker", () => {
  beforeEach(() => {
    vi.stubGlobal("PushManager", class {});
    vi.stubGlobal("Notification", {
      permission: "granted",
      requestPermission: async () => "granted",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    // oxlint-disable-next-line typescript/no-explicit-any -- jsdom has no serviceWorker to restore
    delete (navigator as any).serviceWorker;
  });

  // No registration means a bounded wait for one still on its way, never the
  // unbounded wait on `ready`.
  it("reports no subscription once the wait for a registration runs out", async () => {
    vi.useFakeTimers();
    stubServiceWorker(undefined);

    const existing = getExistingSubscription();
    await vi.advanceTimersByTimeAsync(3000);
    expect(await existing).toBeNull();

    const removed = unsubscribeFromPush();
    await vi.advanceTimersByTimeAsync(3000);
    expect(await removed).toBeNull();
  });

  it("refuses to subscribe once the wait for a registration runs out", async () => {
    vi.useFakeTimers();
    stubServiceWorker(undefined);

    const result = subscribeToPush(VAPID_KEY).catch((err: unknown) => err);
    await vi.advanceTimersByTimeAsync(3000);
    expect(await result).toBeInstanceOf(Error);
  });

  it("uses a registration that finishes while it waits", async () => {
    const sub = { endpoint: "https://push.example/late" };
    let ready!: (registration: unknown) => void;
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: new Promise((resolve) => {
          ready = resolve;
        }),
        getRegistration: async () => undefined,
      },
    });

    const existing = getExistingSubscription();
    ready({ active: {}, pushManager: { getSubscription: async () => sub } });
    expect(await settle(existing)).toBe(sub);
  });

  it("reads and creates subscriptions through the existing registration", async () => {
    const sub = {
      endpoint: "https://push.example/abc",
      options: {},
      getKey: () => new Uint8Array([1, 2, 3]).buffer,
      unsubscribe: vi.fn(async () => true),
    };
    let current: typeof sub | null = null;
    stubServiceWorker({
      active: {},
      pushManager: {
        getSubscription: async () => current,
        subscribe: async () => {
          current = sub;
          return sub;
        },
      },
    });

    expect(await settle(getExistingSubscription())).toBeNull();
    const created = await settle(subscribeToPush(VAPID_KEY));
    expect(created).toMatchObject({ endpoint: sub.endpoint });
    expect(await settle(getExistingSubscription())).toBe(sub);
    expect(await settle(unsubscribeFromPush())).toBe(sub.endpoint);
    expect(sub.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
