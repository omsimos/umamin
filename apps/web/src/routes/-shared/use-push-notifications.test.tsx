import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "test-vapid-key");
  type FakeSub = { endpoint: string; unsubscribe: () => Promise<boolean> };
  return {
    // The browser's PushManager: at most one subscription, whoever is signed in.
    browser: { sub: null as FakeSub | null, unsubscribeFails: false },
    callAction: vi.fn(),
  };
});

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/this-device";
const ALL = 15;

function browserSubscription() {
  const sub = {
    endpoint: ENDPOINT,
    unsubscribe: async () => {
      if (mocks.browser.unsubscribeFails) throw new Error("unsubscribe failed");
      mocks.browser.sub = null;
      return true;
    },
  };
  mocks.browser.sub = sub;
  return sub;
}

vi.mock("@/lib/push-client", () => ({
  isPushSupported: () => true,
  isIosWebPushBlocked: () => false,
  getExistingSubscription: async () => mocks.browser.sub,
  subscribeToPush: async () => {
    const sub = mocks.browser.sub ?? browserSubscription();
    return { endpoint: sub.endpoint, p256dh: "k", auth: "a" };
  },
  unsubscribeFromPush: async () => {
    const sub = mocks.browser.sub;
    if (!sub) return null;
    await sub.unsubscribe();
    return sub.endpoint;
  },
}));
vi.mock("@/lib/api", () => ({ callAction: mocks.callAction }));
vi.mock("@/lib/query-fetchers", () => ({
  fetchCurrentUserOptional: vi.fn(async () => ({})),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { queryKeys } from "@/lib/query";
import { usePushNotifications } from "./use-push-notifications";

const OWNER_KEY = "umamin:push-owner";

function setup(user: { id: string; pushPrefs: number }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(queryKeys.currentUser(), { user });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const mount = () => renderHook(() => usePushNotifications(), { wrapper });
  return { mount };
}

async function settled(result: { current: { state: string } }) {
  await waitFor(() => expect(result.current.state).not.toBe("loading"));
  return result.current.state;
}

beforeEach(() => {
  mocks.browser.sub = null;
  mocks.browser.unsubscribeFails = false;
  mocks.callAction.mockReset();
  localStorage.clear();
  vi.stubGlobal("Notification", {
    permission: "granted",
    requestPermission: vi.fn(async () => "granted"),
  });
});

describe("usePushNotifications", () => {
  it("turns on when both the browser and the server register", async () => {
    mocks.callAction.mockResolvedValue({ pushPrefs: ALL });
    const { mount } = setup({ id: "alice", pushPrefs: 0 });
    const { result } = mount();
    expect(await settled(result)).toBe("off");

    act(() => result.current.enable());

    await waitFor(() => expect(result.current.state).toBe("on"));
    expect(localStorage.getItem(OWNER_KEY)).toBe("alice");
  });

  it("undoes the browser subscription when the server register fails", async () => {
    mocks.callAction.mockResolvedValue({ error: "Something went wrong" });
    const { mount } = setup({ id: "alice", pushPrefs: 0 });
    const first = mount();
    await settled(first.result);

    act(() => first.result.current.enable());
    await waitFor(() => expect(first.result.current.isPending).toBe(false));

    expect(first.result.current.state).toBe("off");
    expect(mocks.browser.sub).toBeNull();
    first.unmount();

    const next = mount();
    expect(await settled(next.result)).toBe("off");
  });

  it("stays off on the next visit when the register fails and the undo fails too", async () => {
    mocks.callAction.mockResolvedValue({ error: "Something went wrong" });
    mocks.browser.unsubscribeFails = true;
    // Push is on for the account through another device.
    const { mount } = setup({ id: "alice", pushPrefs: ALL });
    const first = mount();
    await settled(first.result);

    act(() => first.result.current.enable());
    await waitFor(() => expect(first.result.current.isPending).toBe(false));
    first.unmount();

    expect(mocks.browser.sub).not.toBeNull();
    const next = mount();
    expect(await settled(next.result)).toBe("off");
  });

  it("keeps the browser subscribed and on when the server unregister fails", async () => {
    browserSubscription();
    localStorage.setItem(OWNER_KEY, "alice");
    mocks.callAction.mockResolvedValue({ error: "Something went wrong" });
    const { mount } = setup({ id: "alice", pushPrefs: ALL });
    const { result } = mount();
    expect(await settled(result)).toBe("on");

    act(() => result.current.disable());
    await waitFor(() => expect(result.current.isPending).toBe(false));

    // Both sides still agree: the server row survived, so the browser keeps
    // its subscription and the toggle stays on.
    expect(mocks.browser.sub).not.toBeNull();
    expect(result.current.state).toBe("on");
  });

  it("reads off when this browser's subscription is registered to another account", async () => {
    browserSubscription();
    localStorage.setItem(OWNER_KEY, "bob");
    const { mount } = setup({ id: "alice", pushPrefs: ALL });
    const { result } = mount();
    expect(await settled(result)).toBe("off");
  });

  it("reads off when the server has push off for the account", async () => {
    browserSubscription();
    const { mount } = setup({ id: "alice", pushPrefs: 0 });
    const { result } = mount();
    expect(await settled(result)).toBe("off");
  });
});
