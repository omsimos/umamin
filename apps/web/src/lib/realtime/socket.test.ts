import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ABNORMAL_CLOSE,
  createReconnectingSocket,
  type ReconnectingSocketOptions,
  type WebSocketLike,
} from "./socket";

class FakeWebSocket implements WebSocketLike {
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  closedWith: number | undefined;
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

  close(code = 1000) {
    if (this.readyState >= 2) return;
    this.readyState = 3;
    this.closedWith = code;
  }

  serverOpen() {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }

  serverSend(data: string) {
    this.onmessage?.({ data } as MessageEvent);
  }

  serverClose(code: number) {
    this.readyState = 3;
    this.onclose?.({ code } as CloseEvent);
  }
}

const KEEPALIVE = {
  ping: "ping",
  pong: "pong",
  intervalMs: 25_000,
  timeoutMs: 10_000,
};

function fakeDoc() {
  const target = new EventTarget() as EventTarget & {
    visibilityState: string;
  };
  target.visibilityState = "visible";
  return target;
}

function setup(overrides: Partial<ReconnectingSocketOptions> = {}) {
  const win = new EventTarget();
  const doc = fakeDoc();
  const onOpen = vi.fn((send: (data: string) => boolean) => send("hello"));
  const onMessage = vi.fn();
  const onClose = vi.fn();
  const socket = createReconnectingSocket({
    url: "wss://example.test/socket",
    onOpen,
    onMessage,
    onClose,
    keepalive: KEEPALIVE,
    WebSocketImpl: FakeWebSocket,
    random: () => 1,
    win,
    doc,
    ...overrides,
  });
  const last = () => FakeWebSocket.instances.at(-1) as FakeWebSocket;
  return { socket, win, doc, onOpen, onMessage, onClose, last };
}

describe("createReconnectingSocket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
  });
  afterEach(() => vi.useRealTimers());

  it("runs onOpen with a working send on every connect", () => {
    const { last, onOpen } = setup();
    last().serverOpen();
    expect(last().sent).toEqual(["hello"]);
    last().serverClose(1006);
    vi.advanceTimersByTime(250);
    last().serverOpen();
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(last().sent).toEqual(["hello"]);
  });

  it("grows the backoff exponentially from 250 ms and caps it at 5 s", () => {
    const { last } = setup();
    const waits: number[] = [];
    for (let i = 0; i < 7; i++) {
      const before = FakeWebSocket.instances.length;
      last().serverClose(1006);
      let waited = 0;
      while (FakeWebSocket.instances.length === before) {
        vi.advanceTimersByTime(50);
        waited += 50;
      }
      waits.push(waited);
    }
    expect(waits).toEqual([250, 500, 1000, 2000, 4000, 5000, 5000]);
  });

  it("applies full jitter to the delay", () => {
    const { last } = setup({ random: () => 0.5 });
    last().serverClose(1006);
    vi.advanceTimersByTime(124);
    expect(FakeWebSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("resets the backoff only after a connection stays up", () => {
    const { last } = setup();
    // Two quick failures push the next delay to 1 s.
    last().serverClose(1006);
    vi.advanceTimersByTime(250);
    last().serverClose(1006);
    vi.advanceTimersByTime(500);
    // Opens then dies at once: no reset, so the delay keeps growing.
    last().serverOpen();
    last().serverClose(1006);
    vi.advanceTimersByTime(999);
    expect(FakeWebSocket.instances).toHaveLength(3);
    vi.advanceTimersByTime(1);
    expect(FakeWebSocket.instances).toHaveLength(4);
    // Stays open past the stable window: back to 250 ms.
    last().serverOpen();
    vi.advanceTimersByTime(5_000);
    last().serverClose(1006);
    vi.advanceTimersByTime(250);
    expect(FakeWebSocket.instances).toHaveLength(5);
  });

  it("pings on the interval and keeps the pong away from onMessage", () => {
    const { last, onMessage } = setup();
    last().serverOpen();
    vi.advanceTimersByTime(25_000);
    expect(last().sent).toEqual(["hello", "ping"]);
    last().serverSend("pong");
    last().serverSend('{"t":"x"}');
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith('{"t":"x"}');
    // Answered, so the timeout never fires and the socket survives.
    vi.advanceTimersByTime(20_000);
    expect(last().readyState).toBe(1);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("treats a missing pong as a dead socket and reconnects", () => {
    const { last, onClose } = setup();
    const first = last();
    first.serverOpen();
    vi.advanceTimersByTime(25_000 + 9_999);
    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(first.closedWith).toBeDefined();
    expect(onClose).toHaveBeenCalledWith(ABNORMAL_CLOSE, true);
    vi.advanceTimersByTime(250);
    expect(FakeWebSocket.instances).toHaveLength(2);
    // The dead socket's late events are ignored.
    first.serverClose(1000);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["online", "win"],
    ["pageshow", "win"],
    ["visibilitychange", "doc"],
  ] as const)(
    "reconnects at once on %s instead of waiting out the backoff",
    (event, source) => {
      const ctx = setup();
      // Build up a long backoff first.
      for (let i = 0; i < 4; i++) {
        ctx.last().serverClose(1006);
        vi.advanceTimersByTime(5_000);
      }
      const count = FakeWebSocket.instances.length;
      ctx.last().serverClose(1006);
      ctx[source].dispatchEvent(new Event(event));
      expect(FakeWebSocket.instances).toHaveLength(count + 1);
    },
  );

  it("ignores visibilitychange to hidden", () => {
    const { last, doc } = setup();
    last().serverClose(1006);
    doc.visibilityState = "hidden";
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("probes an open socket on a trigger and drops it without a pong", () => {
    const { last, win, onClose } = setup();
    last().serverOpen();
    win.dispatchEvent(new Event("online"));
    expect(last().sent).toEqual(["hello", "ping"]);
    vi.advanceTimersByTime(10_000);
    expect(onClose).toHaveBeenCalledWith(ABNORMAL_CLOSE, true);
  });

  it("stops on a permanent close code", () => {
    const { last, win, onClose } = setup({
      isPermanentClose: (code) => code === 4401,
    });
    last().serverOpen();
    last().serverClose(4401);
    expect(onClose).toHaveBeenCalledWith(4401, false);
    vi.advanceTimersByTime(60_000);
    win.dispatchEvent(new Event("online"));
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("close() stops everything: socket, reconnects, listeners and timers", () => {
    const { socket, last, win, doc, onClose } = setup();
    last().serverOpen();
    socket.close();
    expect(last().closedWith).toBe(1000);
    expect(socket.isOpen()).toBe(false);
    expect(socket.send("x")).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    win.dispatchEvent(new Event("online"));
    win.dispatchEvent(new Event("pageshow"));
    doc.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(60_000);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("close() during a backoff cancels the pending reconnect", () => {
    const { socket, last } = setup();
    last().serverClose(1006);
    socket.close();
    vi.advanceTimersByTime(60_000);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});
