import {
  env,
  evictDurableObject,
  runDurableObjectAlarm,
  runInDurableObject,
} from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  DM_MAX_SOCKET_AGE_MS,
  DM_PAGE_SIZE,
  DM_STALE_SOCKET_MS,
  MAX_SOCKETS_PER_SIDE,
} from "../src/lib/dm/constants";
import type { ThreadSnapshot } from "../src/lib/dm/engine";
import { dmPair, dmRoomName } from "../src/lib/dm/pair";
import {
  CLOSE,
  DM_CLOSED,
  DM_PROTOCOL_VERSION,
  type DmServerFrame,
  PING,
  PONG,
} from "../src/lib/dm/protocol";
import { DM_HEADERS, type DmRoom } from "../src/server-lib/dm/room";
import type { DmStore } from "../src/server-lib/dm/store";

type FrameOf<T extends DmServerFrame["t"]> = Extract<DmServerFrame, { t: T }>;

beforeAll(async () => {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const raw = await crypto.subtle.exportKey("raw", key);
  process.env.AES_256_GCM_KEY = Buffer.from(new Uint8Array(raw)).toString(
    "base64",
  );
});

const live: Client[] = [];

class Client {
  readonly raw: string[] = [];
  closed: { code: number; reason: string } | null = null;
  private readonly ws: WebSocket;
  private wake = new Set<() => void>();

  constructor(res: Response) {
    if (res.status !== 101 || !res.webSocket) {
      throw new Error(`expected an upgrade, got ${res.status}`);
    }
    this.ws = res.webSocket;
    this.ws.addEventListener("message", (e) => {
      this.raw.push(e.data as string);
      for (const fn of this.wake) fn();
    });
    this.ws.addEventListener("close", (e) => {
      this.closed = { code: e.code, reason: e.reason };
      for (const fn of this.wake) fn();
    });
    this.ws.accept();
    live.push(this);
  }

  get frames(): DmServerFrame[] {
    return this.raw
      .filter((r) => r !== PONG)
      .map((r) => JSON.parse(r) as DmServerFrame);
  }

  send(frame: object) {
    this.ws.send(JSON.stringify(frame));
  }

  sendRaw(data: string) {
    this.ws.send(data);
  }

  close() {
    try {
      this.ws.close(1000, "bye");
    } catch {
      // Already closed.
    }
  }

  private until<R>(check: () => R | undefined, label: string): Promise<R> {
    return new Promise((resolve, reject) => {
      const tryNow = () => {
        const hit = check();
        if (hit === undefined) return false;
        clearTimeout(timer);
        this.wake.delete(onWake);
        resolve(hit);
        return true;
      };
      const onWake = () => void tryNow();
      const timer = setTimeout(() => {
        this.wake.delete(onWake);
        reject(
          new Error(
            `timed out waiting for ${label}; got ${JSON.stringify(this.raw)}, closed ${JSON.stringify(this.closed)}`,
          ),
        );
      }, 2000);
      if (!tryNow()) this.wake.add(onWake);
    });
  }

  next<T extends DmServerFrame["t"]>(
    t: T,
    pred: (f: FrameOf<T>) => boolean = () => true,
  ): Promise<FrameOf<T>> {
    return this.until(
      () =>
        this.frames.find(
          (f): f is FrameOf<T> => f.t === t && pred(f as FrameOf<T>),
        ),
      t,
    );
  }

  count(t: DmServerFrame["t"]) {
    return this.frames.filter((f) => f.t === t).length;
  }

  closeCode(): Promise<number> {
    return this.until(() => this.closed?.code, "close");
  }
}

afterEach(() => {
  for (const c of live.splice(0)) c.close();
});

class FakeStore implements DmStore {
  writes: ThreadSnapshot[] = [];
  pushes: [string, string][] = [];
  reports: Parameters<DmStore["insertReport"]>[0][] = [];
  allowed = true;
  blocked = false;
  failReports = false;

  async canMessage() {
    return this.allowed;
  }
  async isBlocked() {
    return this.blocked;
  }
  async writeThread(_pair: unknown, s: ThreadSnapshot) {
    this.writes.push(structuredClone(s));
  }
  async insertReport(input: Parameters<DmStore["insertReport"]>[0]) {
    if (this.failReports) throw new Error("turso down");
    const dup = this.reports.some(
      (r) =>
        r.reporterId === input.reporterId && r.messageSeq === input.messageSeq,
    );
    if (dup) return false;
    this.reports.push(input);
    return true;
  }
  async pushMessage(recipientId: string, senderId: string) {
    this.pushes.push([recipientId, senderId]);
  }
}

/** A fresh pair and room per test. "a" sorts low, "b" high. */
function setup() {
  const suffix = crypto.randomUUID().slice(0, 8);
  const a = `a-${suffix}`;
  const b = `b-${suffix}`;
  const pair = dmPair(a, b);
  const stub = env.DM_ROOM.getByName(dmRoomName(pair.threadId));
  const store = new FakeStore();
  const install = () =>
    runInDurableObject(stub, (instance: DmRoom) => instance.__setStore(store));
  return { a, b, pair, stub, store, install };
}

async function connect(
  stub: DurableObjectStub,
  threadId: string,
  userId: string,
  canSend = true,
) {
  const c = new Client(
    await stub.fetch("https://dm.test/", {
      headers: {
        Upgrade: "websocket",
        [DM_HEADERS.thread]: threadId,
        [DM_HEADERS.user]: userId,
        [DM_HEADERS.canSend]: canSend ? "1" : "0",
      },
    }),
  );
  return c;
}

async function join(
  stub: DurableObjectStub,
  threadId: string,
  userId: string,
  canSend = true,
) {
  const c = await connect(stub, threadId, userId, canSend);
  c.send({ t: "hi", v: DM_PROTOCOL_VERSION });
  await c.next("sync");
  return c;
}

let opSeq = 0;
const op = () => `op-${++opSeq}`;

async function sendText(c: Client, text: string, extra: object = {}) {
  const id = op();
  c.send({ t: "send", id, text, ...extra });
  const ack = await c.next("ack", (f) => f.id === id);
  return ack.messageId as string;
}

function tableCount(stub: DurableObjectStub) {
  return runInDurableObject(
    stub,
    (_i, state) =>
      state.storage.sql
        .exec<{ n: number }>("SELECT COUNT(*) AS n FROM sqlite_master")
        .one().n,
  );
}

async function eventually(
  check: () => boolean | Promise<boolean>,
  label: string,
) {
  for (let i = 0; i < 200; i += 1) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`never became true: ${label}`);
}

describe("DmRoom sockets", () => {
  it("rejects a user who isn't part of the pair", async () => {
    const { stub, pair } = setup();
    const c = await connect(stub, pair.threadId, "intruder");
    expect(await c.closeCode()).toBe(CLOSE.UNAUTHORIZED);
  });

  it("rejects an old protocol version", async () => {
    const { stub, pair, a } = setup();
    const c = await connect(stub, pair.threadId, a);
    c.send({ t: "hi", v: DM_PROTOCOL_VERSION + 1 });
    expect(await c.closeCode()).toBe(CLOSE.VERSION);
  });

  it("writes no storage when a conversation is only opened", async () => {
    const { stub, pair, a, install } = setup();
    await install();
    const c = await join(stub, pair.threadId, a);
    expect((await c.next("sync")).messages).toEqual([]);
    expect(await tableCount(stub)).toBe(0);
  });

  it("serves only the pair it was created for", async () => {
    const { stub, pair, a, install } = setup();
    await install();
    const c = await join(stub, pair.threadId, a);
    await sendText(c, "hello");
    const other = dmPair(a, "zzz-other");
    const intruder = await connect(stub, other.threadId, a);
    expect(await intruder.closeCode()).toBe(CLOSE.UNAUTHORIZED);
  });
});

describe("DmRoom socket cap", () => {
  it("sweeps half-open sockets before refusing a new one for the cap", async () => {
    const { stub, pair, a, install } = setup();
    await install();
    const old: Client[] = [];
    for (let i = 0; i < MAX_SOCKETS_PER_SIDE; i += 1) {
      old.push(await join(stub, pair.threadId, a));
    }
    // No pongs were sent, so backdating the connect time makes them stale.
    await runInDurableObject(stub, (_i, state) => {
      for (const ws of state.getWebSockets()) {
        const att = ws.deserializeAttachment() as {
          connectedAt: number;
        } | null;
        if (att) {
          ws.serializeAttachment({
            ...att,
            connectedAt: Date.now() - DM_STALE_SOCKET_MS - 1,
          });
        }
      }
    });
    const fresh = await join(stub, pair.threadId, a);
    expect(fresh.closed).toBeNull();
    for (const c of old) expect(await c.closeCode()).toBe(CLOSE.NORMAL);
  });
});

describe("DmRoom messages", () => {
  it("delivers to both sides and echoes the client id only to the sender", async () => {
    const { stub, pair, a, b, install } = setup();
    await install();
    const ca = await join(stub, pair.threadId, a);
    const cb = await join(stub, pair.threadId, b);
    const id = op();
    ca.send({ t: "send", id, text: "  hi bob  " });
    const forA = await ca.next("msgs");
    const forB = await cb.next("msgs");
    expect(forA.messages[0]).toMatchObject({
      text: "hi bob",
      mine: true,
      clientId: id,
    });
    expect(forB.messages[0]).toMatchObject({ text: "hi bob", mine: false });
    expect(forB.messages[0]?.clientId).toBeUndefined();
  });

  it("stores the text encrypted", async () => {
    const { stub, pair, a, install } = setup();
    await install();
    const c = await join(stub, pair.threadId, a);
    await sendText(c, "secret words");
    const body = await runInDurableObject(
      stub,
      (_i, state) =>
        state.storage.sql
          .exec<{ body: string }>("SELECT body FROM messages")
          .one().body,
    );
    expect(body).not.toContain("secret");
  });

  it("does not store a retried send twice", async () => {
    const { stub, pair, a, install } = setup();
    await install();
    const c = await join(stub, pair.threadId, a);
    c.send({ t: "send", id: "same", text: "once" });
    c.send({ t: "send", id: "same", text: "once" });
    await eventually(() => c.count("ack") === 2, "two acks");
    const acks = c.frames.filter((f): f is FrameOf<"ack"> => f.t === "ack");
    expect(acks[0]?.messageId).toBe(acks[1]?.messageId);
  });

  it("refuses sends without access but still allows unsend", async () => {
    const { stub, pair, a, install } = setup();
    await install();
    const open = await join(stub, pair.threadId, a);
    const seq = await sendText(open, "before");
    open.close();

    const closed = await join(stub, pair.threadId, a, false);
    expect((await closed.next("sync")).meta.canSend).toBe(false);
    closed.send({ t: "send", id: "x", text: "after" });
    expect((await closed.next("err", (f) => f.id === "x")).code).toBe("closed");
    closed.send({ t: "unsend", id: "u", messageId: seq });
    await closed.next("ack", (f) => f.id === "u");
    const msgs = await closed.next("msgs");
    expect(msgs.messages[0]?.text).toBeNull();
  });

  it("keeps history across eviction", async () => {
    const { stub, pair, a, b, install } = setup();
    await install();
    const c = await join(stub, pair.threadId, a);
    await sendText(c, "remember me");
    c.close();
    await evictDurableObject(stub);
    await install();
    const cb = await join(stub, pair.threadId, b);
    expect((await cb.next("sync")).messages.map((m) => m.text)).toEqual([
      "remember me",
    ]);
  });

  it("pages history oldest first", async () => {
    const { stub, pair, a, b, install } = setup();
    await install();
    const total = DM_PAGE_SIZE + 5;
    await runInDurableObject(stub, async (instance: DmRoom) => {
      const room = instance as unknown as {
        insertRow(t: string, m: object, c: string | null): Promise<unknown>;
      };
      for (let i = 1; i <= total; i += 1) {
        await room.insertRow(
          pair.threadId,
          {
            author: i % 2,
            text: `m${i}`,
            replyTo: null,
            reactionLow: null,
            reactionHigh: null,
            createdAt: i,
          },
          null,
        );
      }
    });
    const c = await join(stub, pair.threadId, b);
    const sync = await c.next("sync");
    expect(sync.hasMore).toBe(true);
    expect(sync.messages).toHaveLength(DM_PAGE_SIZE);
    expect(sync.messages.at(-1)?.text).toBe(`m${total}`);
    c.send({ t: "history", id: "h", before: sync.messages[0]?.id });
    const page = await c.next("history", (f) => f.id === "h");
    expect(page.hasMore).toBe(false);
    expect(page.messages.map((m) => m.text)).toEqual([
      "m1",
      "m2",
      "m3",
      "m4",
      "m5",
    ]);
    void a;
  });
});

describe("DmRoom thread index", () => {
  it("writes the first message at once and coalesces the rest into one alarm write", async () => {
    const { stub, pair, a, store, install } = setup();
    await install();
    const c = await join(stub, pair.threadId, a);
    await sendText(c, "one");
    await eventually(() => store.writes.length === 1, "first write");
    expect(store.writes[0]).toMatchObject({
      lastSeq: 1,
      lastSender: 0,
      preview: "one",
    });

    await sendText(c, "two");
    await sendText(c, "three");
    expect(store.writes).toHaveLength(1);

    expect(await runDurableObjectAlarm(stub)).toBe(true);
    expect(store.writes).toHaveLength(2);
    expect(store.writes[1]).toMatchObject({ lastSeq: 3, preview: "three" });
  });

  it("writes at once when the recipient reads, and tells the sender", async () => {
    const { stub, pair, a, b, store, install } = setup();
    await install();
    const ca = await join(stub, pair.threadId, a);
    const cb = await join(stub, pair.threadId, b);
    const seq = await sendText(ca, "read me");
    await eventually(() => store.writes.length === 1, "first write");
    cb.send({ t: "read", upTo: seq });
    await ca.next("meta", (f) => f.meta.peerReadSeq === Number(seq));
    await eventually(() => store.writes.length === 2, "read write");
    expect(store.writes[1]?.readSeq).toEqual([0, Number(seq)]);
  });

  describe("live exchange", () => {
    it("a live exchange costs one index write per debounce window", async () => {
      const { stub, pair, a, b, store, install } = setup();
      await install();
      const ca = await join(stub, pair.threadId, a);
      const cb = await join(stub, pair.threadId, b);

      const seq1 = await sendText(ca, "m1");
      await eventually(() => store.writes.length === 1, "first write");
      cb.send({ t: "read", upTo: seq1 });
      await eventually(() => store.writes.length === 2, "read write");

      const seq2 = await sendText(ca, "m2");
      cb.send({ t: "read", upTo: seq2 });
      await ca.next("meta", (f) => f.meta.peerReadSeq === Number(seq2));
      expect(store.writes).toHaveLength(2);

      expect(await runDurableObjectAlarm(stub)).toBe(true);
      expect(store.writes).toHaveLength(3);
      expect(store.writes[2]).toMatchObject({ lastSeq: 2, preview: "m2" });
      expect(store.writes[2]?.readSeq).toEqual([0, 2]);
    });
  });

  it("hides history for one side only", async () => {
    const { stub, pair, a, b, store, install } = setup();
    await install();
    const ca = await join(stub, pair.threadId, a);
    await sendText(ca, "old");
    await runInDurableObject(stub, (instance: DmRoom) => instance.hide(b));
    expect(store.writes.at(-1)?.hiddenSeq).toEqual([0, 1]);
    const cb = await join(stub, pair.threadId, b);
    expect((await cb.next("sync")).messages).toEqual([]);
    ca.close();
    const ca2 = await join(stub, pair.threadId, a);
    expect((await ca2.next("sync")).messages).toHaveLength(1);
  });
});

describe("DmRoom push", () => {
  it("pushes an offline recipient once per cooldown", async () => {
    const { stub, pair, a, b, store, install } = setup();
    await install();
    const ca = await join(stub, pair.threadId, a);
    await sendText(ca, "you there?");
    await sendText(ca, "hello?");
    await eventually(() => store.pushes.length === 1, "one push");
    expect(store.pushes[0]).toEqual([b, a]);
  });

  it("does not push a recipient who has the conversation open", async () => {
    const { stub, pair, a, b, store, install } = setup();
    await install();
    const ca = await join(stub, pair.threadId, a);
    await join(stub, pair.threadId, b);
    await sendText(ca, "hi");
    await new Promise((r) => setTimeout(r, 50));
    expect(store.pushes).toEqual([]);
  });
});

describe("DmRoom access changes", () => {
  it("closes every socket on a block", async () => {
    const { stub, pair, a, b, install } = setup();
    await install();
    const ca = await join(stub, pair.threadId, a);
    const cb = await join(stub, pair.threadId, b);
    await runInDurableObject(stub, (instance: DmRoom) =>
      instance.sever("block"),
    );
    expect(await ca.closeCode()).toBe(DM_CLOSED);
    expect(await cb.closeCode()).toBe(DM_CLOSED);
  });

  it("stops sending but keeps the socket on an unfollow", async () => {
    const { stub, pair, a, install } = setup();
    await install();
    const c = await join(stub, pair.threadId, a);
    await runInDurableObject(stub, (instance: DmRoom) =>
      instance.sever("unfollow"),
    );
    await c.next("meta", (f) => !f.meta.canSend);
    c.send({ t: "send", id: "late", text: "still there?" });
    expect((await c.next("err", (f) => f.id === "late")).code).toBe("closed");
    expect(c.closed).toBeNull();
  });

  it("closes the conversation for both sides when the recheck finds a block", async () => {
    const { stub, pair, a, b, store, install } = setup();
    await install();
    const ca = await join(stub, pair.threadId, a);
    const cb = await join(stub, pair.threadId, b);
    store.allowed = false;
    store.blocked = true;
    await runInDurableObject(stub, (_i, state) => {
      for (const ws of state.getWebSockets()) {
        const att = ws.deserializeAttachment() as Record<
          string,
          unknown
        > | null;
        if (att) ws.serializeAttachment({ ...att, checkedAt: 0 });
      }
    });
    ca.send({ t: "send", id: "late", text: "after" });
    expect(await ca.closeCode()).toBe(DM_CLOSED);
    expect(await cb.closeCode()).toBe(DM_CLOSED);
  });

  it("sends no typing or presence to a read-only socket and forwards none from it", async () => {
    const { stub, pair, a, b, install } = setup();
    await install();
    const ca = await join(stub, pair.threadId, a);
    await runInDurableObject(stub, (instance: DmRoom) =>
      instance.sever("unfollow"),
    );
    await ca.next("meta", (f) => !f.meta.canSend);
    const cb = await join(stub, pair.threadId, b);
    // b coming online still pushes a meta frame, but a, now read-only, must
    // not learn that b is there.
    await eventually(() => ca.count("meta") >= 2, "meta after peer joins");
    expect(ca.frames.every((f) => f.t !== "meta" || !f.meta.peerOnline)).toBe(
      true,
    );
    cb.send({ t: "typing", on: true });
    ca.send({ t: "typing", on: true });
    await new Promise((r) => setTimeout(r, 50));
    expect(ca.count("typing")).toBe(0);
    expect(cb.count("typing")).toBe(0);
  });

  it("refuses sends once the recheck finds access gone, and tells both sides", async () => {
    const { stub, pair, a, b, store, install } = setup();
    await install();
    const ca = await join(stub, pair.threadId, a);
    const cb = await join(stub, pair.threadId, b);
    await sendText(ca, "while allowed");
    store.allowed = false;
    // Pretend the last check was long ago instead of waiting 5 minutes.
    await runInDurableObject(stub, (_i, state) => {
      for (const ws of state.getWebSockets()) {
        const att = ws.deserializeAttachment() as Record<
          string,
          unknown
        > | null;
        if (att) ws.serializeAttachment({ ...att, checkedAt: 0 });
      }
    });
    ca.send({ t: "send", id: "late", text: "after" });
    expect((await ca.next("err", (f) => f.id === "late")).code).toBe("closed");
    await cb.next("meta", (f) => !f.meta.canSend);
  });

  it("does not ask the store again inside the recheck window", async () => {
    const { stub, pair, a, store, install } = setup();
    await install();
    const ca = await join(stub, pair.threadId, a);
    // The store would now refuse, but the check at connect time is fresh, so
    // the cached answer stands and the send still goes through.
    store.allowed = false;
    await sendText(ca, "still ok");
    expect(ca.count("err")).toBe(0);
  });

  it("closes only the revoked user's sockets", async () => {
    const { stub, pair, a, b, install } = setup();
    await install();
    const ca = await join(stub, pair.threadId, a);
    const cb = await join(stub, pair.threadId, b);
    await runInDurableObject(stub, (instance: DmRoom) => instance.revoke(a));
    expect(await ca.closeCode()).toBe(CLOSE.NORMAL);
    await new Promise((r) => setTimeout(r, 50));
    expect(cb.closed).toBeNull();
  });

  it("closes a socket past the age cap so it reconnects through the session check", async () => {
    const { stub, pair, a, b, install } = setup();
    await install();
    const ca = await join(stub, pair.threadId, a);
    const cb = await join(stub, pair.threadId, b);
    // A recent pong keeps the socket "fresh"; only its age should close it.
    ca.sendRaw(PING);
    await eventually(() => ca.raw.includes(PONG), "pong");
    await runInDurableObject(stub, (_i, state) => {
      for (const ws of state.getWebSockets()) {
        const att = ws.deserializeAttachment() as {
          side: number;
          connectedAt: number;
        } | null;
        if (att?.side === 0) {
          ws.serializeAttachment({
            ...att,
            connectedAt: Date.now() - DM_MAX_SOCKET_AGE_MS - 1,
          });
        }
      }
    });
    await sendText(cb, "after expiry");
    expect(await ca.closeCode()).toBe(CLOSE.NORMAL);
    expect(ca.frames.some((f) => f.t === "msgs")).toBe(false);
  });

  it("wipes all storage on purge", async () => {
    const { stub, pair, a, install } = setup();
    await install();
    const c = await join(stub, pair.threadId, a);
    await sendText(c, "gone soon");
    await runInDurableObject(stub, (instance: DmRoom) => instance.purge());
    expect(await c.closeCode()).toBe(DM_CLOSED);
    expect(await tableCount(stub)).toBe(0);
  });

  it("keeps a purged room empty when an in-flight op lands afterwards", async () => {
    const { stub, pair, a, install } = setup();
    await install();
    const c = await join(stub, pair.threadId, a);
    await sendText(c, "gone soon");
    await runInDurableObject(stub, (instance: DmRoom) => instance.purge());
    await runInDurableObject(stub, async (instance: DmRoom) => {
      const room = instance as unknown as {
        insertRow(t: string, m: object, c: string | null): Promise<unknown>;
      };
      await expect(
        room.insertRow(
          pair.threadId,
          {
            author: 0,
            text: "late",
            replyTo: null,
            reactionLow: null,
            reactionHigh: null,
            createdAt: 1,
          },
          null,
        ),
      ).rejects.toThrow("purged");
    });
    expect(await tableCount(stub)).toBe(0);
  });
});

describe("DmRoom reports", () => {
  it("snapshots the reported message with the context before it", async () => {
    const { stub, pair, a, b, store, install } = setup();
    await install();
    const ca = await join(stub, pair.threadId, a);
    const cb = await join(stub, pair.threadId, b);
    await sendText(ca, "hey");
    await sendText(cb, "hi");
    const bad = await sendText(cb, "something awful");
    ca.send({ t: "report", id: "r1", messageId: bad, reason: "harassment" });
    await ca.next("ack", (f) => f.id === "r1");
    expect(store.reports[0]).toMatchObject({
      reporterId: a,
      reportedId: b,
      reason: "harassment",
    });
    expect(
      store.reports[0]?.entries.map((e) => [e.text, e.fromReporter]),
    ).toEqual([
      ["hey", true],
      ["hi", false],
      ["something awful", false],
    ]);
  });

  it("refuses to report your own message and limits repeat reports", async () => {
    const { stub, pair, a, b, install } = setup();
    await install();
    const ca = await join(stub, pair.threadId, a);
    const cb = await join(stub, pair.threadId, b);
    const own = await sendText(ca, "mine");
    ca.send({ t: "report", id: "r1", messageId: own, reason: "spam" });
    expect((await ca.next("err", (f) => f.id === "r1")).code).toBe("invalid");
    const theirs = await sendText(cb, "theirs");
    ca.send({ t: "report", id: "r2", messageId: theirs, reason: "spam" });
    await ca.next("ack", (f) => f.id === "r2");
    const more = await sendText(cb, "more");
    ca.send({ t: "report", id: "r3", messageId: more, reason: "spam" });
    expect((await ca.next("err", (f) => f.id === "r3")).code).toBe(
      "rate_limited",
    );
  });

  it("answers a report that failed inside the room with an err frame", async () => {
    const { stub, pair, a, b, store, install } = setup();
    await install();
    const ca = await join(stub, pair.threadId, a);
    const cb = await join(stub, pair.threadId, b);
    const bad = await sendText(cb, "something awful");
    store.failReports = true;
    ca.send({ t: "report", id: "r-fail", messageId: bad, reason: "spam" });
    expect((await ca.next("err", (f) => f.id === "r-fail")).code).toBe(
      "unavailable",
    );
  });
});
