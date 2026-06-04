import { act, render } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PRESENCE_HEARTBEAT_MS } from "../../../convex/constants";
import { MatchPresence } from "./match-presence";

const { fakeConvex } = vi.hoisted(() => ({
  fakeConvex: {
    url: "https://convex.test",
    mutation: vi.fn(async (..._args: unknown[]) => ({
      roomToken: "rt",
      sessionToken: "st",
    })),
  },
}));

vi.mock("convex/react", () => ({
  useConvex: () => fakeConvex,
}));

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

const flush = () => act(async () => {});

// `api.*` is a proxy minting a fresh reference per access — compare by name.
const calls = (name: string) =>
  fakeConvex.mutation.mock.calls.filter(
    ([fn]) => getFunctionName(fn as never) === name,
  );
const heartbeats = () => calls("presence:heartbeat");
const disconnects = () => calls("presence:disconnect");

describe("MatchPresence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fakeConvex.mutation.mockClear();
    navigator.sendBeacon = vi.fn(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
    setHidden(false);
  });

  it("heartbeats on mount and on every interval", async () => {
    render(<MatchPresence matchId="m1" />);
    await flush();
    expect(heartbeats()).toHaveLength(1);
    expect(heartbeats()[0][1]).toMatchObject({
      roomId: "m1",
      interval: PRESENCE_HEARTBEAT_MS,
    });

    await act(async () => {
      vi.advanceTimersByTime(PRESENCE_HEARTBEAT_MS);
    });
    expect(heartbeats()).toHaveLength(2);
  });

  it("does NOT disconnect when the tab is hidden, and re-beats on return", async () => {
    render(<MatchPresence matchId="m1" />);
    await flush();
    const before = heartbeats().length;

    await act(async () => setHidden(true));
    expect(disconnects()).toHaveLength(0);
    expect(navigator.sendBeacon).not.toHaveBeenCalled();

    await act(async () => setHidden(false));
    expect(heartbeats().length).toBe(before + 1);
  });

  it("sends a disconnect beacon on pagehide (real departure)", async () => {
    render(<MatchPresence matchId="m1" />);
    await flush();

    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
    const [url, body] = vi.mocked(navigator.sendBeacon).mock.calls[0];
    expect(url).toBe("https://convex.test/api/mutation");
    expect(await (body as Blob).text()).toContain("presence:disconnect");
  });

  it("disconnects gracefully on unmount", async () => {
    const { unmount } = render(<MatchPresence matchId="m1" />);
    await flush();
    unmount();
    expect(disconnects()).toHaveLength(1);
    expect(disconnects()[0][1]).toEqual({ sessionToken: "st" });
  });
});
