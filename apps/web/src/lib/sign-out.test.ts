import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  supported: true,
  sub: null as { endpoint: string } | null,
  lookupHangs: false,
  unsubscribeFails: false,
  unsubscribed: 0,
  callAction: vi.fn(),
}));

vi.mock("@/lib/push-client", () => ({
  isPushSupported: () => mocks.supported,
  getExistingSubscription: () =>
    mocks.lookupHangs ? new Promise(() => {}) : Promise.resolve(mocks.sub),
  unsubscribeFromPush: async () => {
    if (mocks.unsubscribeFails) throw new Error("unsubscribe failed");
    mocks.unsubscribed += 1;
    return mocks.sub?.endpoint ?? null;
  },
}));
vi.mock("@/lib/api", () => ({ callAction: mocks.callAction }));

import { signOut } from "./sign-out";

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/this-device";
const OWNER_KEY = "umamin:push-owner";

function calledActions(): string[] {
  return mocks.callAction.mock.calls.map((c) => c[0]);
}

describe("signOut", () => {
  beforeEach(() => {
    mocks.supported = true;
    mocks.sub = null;
    mocks.lookupHangs = false;
    mocks.unsubscribeFails = false;
    mocks.unsubscribed = 0;
    mocks.callAction.mockReset();
    mocks.callAction.mockResolvedValue({ redirect: "/login" });
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("removes this browser's push row with the logout, then unsubscribes", async () => {
    mocks.sub = { endpoint: ENDPOINT };
    localStorage.setItem(OWNER_KEY, "u1");

    await signOut();

    expect(calledActions()).toEqual(["logout"]);
    expect(mocks.callAction.mock.calls[0][1]).toEqual({
      pushEndpoint: ENDPOINT,
    });
    expect(mocks.unsubscribed).toBe(1);
    expect(localStorage.getItem(OWNER_KEY)).toBe("");
  });

  it("signs out without touching push when this browser has no subscription", async () => {
    mocks.sub = null;

    const res = await signOut();

    expect(calledActions()).toEqual(["logout"]);
    expect(mocks.callAction.mock.calls[0][1]).toBeUndefined();
    expect(mocks.unsubscribed).toBe(0);
    expect(res).toEqual({ redirect: "/login" });
  });

  it("keeps push working when the logout fails", async () => {
    mocks.sub = { endpoint: ENDPOINT };
    localStorage.setItem(OWNER_KEY, "u1");
    mocks.callAction.mockResolvedValue({ error: "Couldn't sign out" });

    await expect(signOut()).rejects.toThrow("Couldn't sign out");

    expect(mocks.unsubscribed).toBe(0);
    expect(localStorage.getItem(OWNER_KEY)).toBe("u1");
  });

  it("a browser unsubscribe that throws does not block sign-out", async () => {
    mocks.sub = { endpoint: ENDPOINT };
    mocks.unsubscribeFails = true;

    await expect(signOut()).resolves.toEqual({ redirect: "/login" });
  });

  it("a subscription lookup that never settles does not block sign-out", async () => {
    vi.useFakeTimers();
    mocks.lookupHangs = true;

    const done = signOut();
    await vi.advanceTimersByTimeAsync(3000);
    await done;

    expect(calledActions()).toEqual(["logout"]);
    expect(mocks.callAction.mock.calls[0][1]).toBeUndefined();
  });

  it("skips push on a browser without push support", async () => {
    mocks.supported = false;
    mocks.sub = { endpoint: ENDPOINT };

    await signOut();

    expect(calledActions()).toEqual(["logout"]);
  });

  it("rejects with the server's message when logout fails", async () => {
    mocks.callAction.mockResolvedValue({ error: "An error occurred" });

    await expect(signOut()).rejects.toMatchObject({
      message: "An error occurred",
    });
  });
});
