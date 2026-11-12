import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLOSE, DM_CLOSED, type DmServerFrame } from "@/lib/dm/protocol";
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

  serverClose(code: number) {
    this.readyState = 3;
    this.onclose?.({ code } as CloseEvent);
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

function switchVisibility(state: "visible" | "hidden") {
  act(() => {
    setVisibility(state);
    document.dispatchEvent(new Event("visibilitychange"));
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

describe("useDmConversation connection and sends", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);
    setVisibility("visible");
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, "visibilityState");
  });

  it("re-sends the original frame when a failed send is retried", () => {
    const { result, socket } = mountOpen();
    act(() => result.current.send("hi", null));
    const [first] = socket.sentFrames("send");
    if (!first?.id) throw new Error("send frame missing");
    act(() => {
      socket.serverSend({ t: "err", id: first.id, code: "rate_limited" });
    });
    expect(result.current.state.messages.at(-1)?.delivery).toBe("failed");

    act(() => result.current.retry(first.id ?? ""));
    expect(socket.sentFrames("send")).toEqual([first, first]);
    expect(result.current.state.messages.at(-1)?.delivery).toBe("sending");
  });

  it("settles a send from its ack when no echo follows", () => {
    const { result, socket } = mountOpen();
    act(() => result.current.send("hi", null));
    const [first] = socket.sentFrames("send");
    if (!first?.id) throw new Error("send frame missing");
    act(() => {
      socket.serverSend({ t: "ack", id: first.id ?? "", messageId: "9" });
    });
    const last = result.current.state.messages.at(-1);
    expect(last?.id).toBe("9");
    expect(last?.text).toBe("hi");
    expect(last?.delivery).toBeUndefined();
  });

  it("settles a retried send the room had already stored", () => {
    const { result, socket } = mountOpen();
    act(() => result.current.send("hi", null));
    const [first] = socket.sentFrames("send");
    const id = first?.id;
    if (!id) throw new Error("send frame missing");
    act(() => {
      socket.serverSend({ t: "err", id, code: "unavailable" });
    });
    expect(result.current.state.messages.at(-1)?.delivery).toBe("failed");

    act(() => result.current.retry(id));
    act(() => {
      socket.serverSend({ t: "ack", id, messageId: "9" });
    });
    const last = result.current.state.messages.at(-1);
    expect(last?.id).toBe("9");
    expect(last?.delivery).toBeUndefined();
  });

  it("does not mark a stored send failed when the room errors after the ack", () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useDmConversation("pal", onError));
    const socket = FakeWebSocket.instances[0];
    if (!socket) throw new Error("no socket opened");
    act(() => {
      socket.serverOpen();
      socket.serverSend({
        t: "sync",
        meta,
        messages: [message],
        hasMore: false,
      });
    });
    act(() => result.current.send("hi", null));
    const [first] = socket.sentFrames("send");
    const id = first?.id;
    if (!id) throw new Error("send frame missing");
    act(() => {
      socket.serverSend({ t: "ack", id, messageId: "9" });
      socket.serverSend({ t: "err", id, code: "unavailable" });
    });
    const last = result.current.state.messages.at(-1);
    expect(last?.id).toBe("9");
    expect(last?.delivery).toBeUndefined();
    expect(onError).not.toHaveBeenCalled();
  });

  it("replays a send made while hidden once the next sync lands", () => {
    const { result } = mountOpen();
    switchVisibility("hidden");
    act(() => result.current.send("later", null));
    switchVisibility("visible");
    const next = FakeWebSocket.instances[1];
    if (!next) throw new Error("no reconnect");
    act(() => {
      next.serverOpen();
      next.serverSend({ t: "sync", meta, messages: [message], hasMore: false });
    });
    expect(next.sentFrames("send")).toHaveLength(1);
  });

  it("reads as paused while hidden and reconnects when shown", () => {
    const { result } = mountOpen();
    switchVisibility("hidden");
    expect(result.current.state.status).toBe("paused");
    switchVisibility("visible");
    expect(result.current.state.status).toBe("connecting");
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("stays outdated after a version close when the reload was already tried", () => {
    // A reload inside the last minute makes the guard decline another one.
    sessionStorage.setItem("umamin-dm:versionReloadAt", String(Date.now()));
    const { result, socket } = mountOpen();
    act(() => socket.serverClose(CLOSE.VERSION));
    expect(result.current.state.status).toBe("outdated");
    switchVisibility("hidden");
    switchVisibility("visible");
    expect(result.current.state.status).toBe("outdated");
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("doesn't reopen a closed chat when the tab regains focus", () => {
    const { result, socket } = mountOpen();
    act(() => socket.serverClose(DM_CLOSED));
    expect(result.current.state.status).toBe("unavailable");
    switchVisibility("hidden");
    switchVisibility("visible");
    expect(result.current.state.status).toBe("unavailable");
    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});
