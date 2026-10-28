import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DmServerFrame } from "@/lib/dm/protocol";
import { useDmConversation } from "./use-dm-conversation";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: ((ev: Event) => unknown) | null = null;
  onmessage: ((ev: MessageEvent) => unknown) | null = null;
  onclose: ((ev: CloseEvent) => unknown) | null = null;
  onerror: ((ev: Event) => unknown) | null = null;

  readonly url: string;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(data: string) {
    if (this.readyState !== 1) throw new Error("not open");
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
  }

  serverOpen() {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }

  serverSend(frame: DmServerFrame) {
    this.onmessage?.({ data: JSON.stringify(frame) } as MessageEvent);
  }

  sentFrames(t: string) {
    return this.sent
      .map((s) => JSON.parse(s) as { t: string; id?: string })
      .filter((f) => f.t === t);
  }
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

const meta = { peerOnline: false, peerReadSeq: 0, canSend: true };
const message = {
  id: "5",
  mine: false,
  text: "hey",
  replyTo: null,
  myReaction: null,
  theirReaction: null,
  createdAt: 1,
};

/** Mounts the hook with an open, synced socket. */
function mountOpen(hasMore = false) {
  const hook = renderHook(() => useDmConversation("pal"));
  const socket = FakeWebSocket.instances[0];
  if (!socket) throw new Error("no socket opened");
  act(() => {
    socket.serverOpen();
    socket.serverSend({ t: "sync", meta, messages: [message], hasMore });
  });
  return { ...hook, socket };
}

describe("useDmConversation requests", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);
    setVisibility("visible");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    Reflect.deleteProperty(document, "visibilityState");
  });

  it("keeps its action identities across incoming frames", () => {
    const { result, socket } = mountOpen();
    const before = { ...result.current, state: undefined };
    act(() => {
      socket.serverSend({ t: "typing", on: true });
      socket.serverSend({ t: "msgs", messages: [{ ...message, id: "6" }] });
    });
    expect(result.current.state.messages).toHaveLength(2);
    for (const key of [
      "send",
      "retry",
      "react",
      "unsend",
      "report",
      "setTyping",
      "loadOlder",
    ] as const) {
      expect(result.current[key]).toBe(before[key]);
    }
  });

  it("loads older from the latest messages after a re-render", () => {
    const { result } = renderHook(() => useDmConversation("pal"));
    const firstRender = result.current.loadOlder;
    const socket = FakeWebSocket.instances[0];
    if (!socket) throw new Error("no socket opened");
    act(() => {
      socket.serverOpen();
      socket.serverSend({
        t: "sync",
        meta,
        messages: [message],
        hasMore: true,
      });
    });
    // The identity from before any messages existed must still see them.
    act(() => firstRender());
    expect(socket.sentFrames("history")).toHaveLength(1);
  });

  it("settles a pending report when the tab hides", async () => {
    const { result } = mountOpen();
    let pending!: ReturnType<typeof result.current.report>;
    act(() => {
      pending = result.current.report("5", "spam");
    });
    act(() => {
      setVisibility("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(pending).resolves.toEqual({ ok: false, code: "offline" });
  });

  it("times out a request the room never answers", async () => {
    vi.useFakeTimers();
    const { result } = mountOpen();
    let pending!: ReturnType<typeof result.current.react>;
    act(() => {
      pending = result.current.react("5", "❤️");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    await expect(pending).resolves.toEqual({
      ok: false,
      code: "unavailable",
    });
  });

  it("clears loading older when the history request fails", () => {
    const { result, socket } = mountOpen(true);
    act(() => result.current.loadOlder());
    expect(result.current.state.loadingOlder).toBe(true);
    const history = socket.sentFrames("history").at(-1);
    expect(history?.id).toBeTruthy();
    act(() => {
      socket.serverSend({ t: "err", id: history?.id, code: "unavailable" });
    });
    return vi.waitFor(() => {
      expect(result.current.state.loadingOlder).toBe(false);
    });
  });
});
