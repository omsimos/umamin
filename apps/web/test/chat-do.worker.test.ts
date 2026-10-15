import {
  env,
  evictDurableObject,
  runDurableObjectAlarm,
  runInDurableObject,
} from "cloudflare:test";
import { afterEach, describe, expect, it } from "vitest";
import { MAX_ROOM_SOCKETS } from "../src/lib/chat/constants";
import { inviteCodeFor } from "../src/lib/chat/invite";
import { LIMITS } from "../src/lib/chat/limits";
import {
  CLOSE,
  PROTOCOL_VERSION,
  type ServerFrame,
} from "../src/lib/chat/protocol";
import type { ChatRoom } from "../src/server-lib/chat/room";
import { hashSecret } from "../src/server-lib/chat/secret";

type FrameOf<T extends ServerFrame["t"]> = Extract<ServerFrame, { t: T }>;

const live: Client[] = [];

/** Test side of one socket: records every raw frame so anti-leak checks can
 *  scan exactly what crossed the wire. */
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
      this.notify();
    });
    this.ws.addEventListener("close", (e) => {
      this.closed = { code: e.code, reason: e.reason };
      this.notify();
    });
    this.ws.accept();
    live.push(this);
  }

  private notify() {
    for (const fn of this.wake) fn();
  }

  get frames(): ServerFrame[] {
    return this.raw.map((r) => JSON.parse(r) as ServerFrame);
  }

  send(frame: object | string) {
    this.ws.send(typeof frame === "string" ? frame : JSON.stringify(frame));
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

  /** The first frame of type `t` at index >= `from` matching `pred`. */
  next<T extends ServerFrame["t"]>(
    t: T,
    pred: (f: FrameOf<T>) => boolean = () => true,
    from = 0,
  ): Promise<FrameOf<T>> {
    return this.until(
      () =>
        this.frames
          .slice(from)
          .find((f): f is FrameOf<T> => f.t === t && pred(f as FrameOf<T>)),
      t,
    );
  }

  closeCode(): Promise<number> {
    return this.until(() => this.closed?.code, "close");
  }
}

afterEach(() => {
  for (const c of live.splice(0)) c.close();
});

const uid = () => crypto.randomUUID();

// --- Lobby ------------------------------------------------------------------

interface Identity {
  sessionId: string;
  secret: string;
  alias: string;
  avatarSeed: string;
  interests: string[];
}

const person = (interests: string[], alias = "Anon"): Identity => ({
  sessionId: uid(),
  secret: uid(),
  alias,
  avatarSeed: `seed-${uid()}`,
  interests,
});

const joinFrame = (p: Identity, extra: object = {}) => ({
  t: "join",
  v: PROTOCOL_VERSION,
  ...p,
  ...extra,
});

/** A private lobby per test, so leftover waiters never pair across tests. */
const newLobby = () => env.CHAT_LOBBY.getByName(`test-${uid()}`);

async function connectLobby(stub: DurableObjectStub, ip: string = uid()) {
  return new Client(
    await stub.fetch("https://chat.test/", {
      headers: { Upgrade: "websocket", "x-umamin-ip": ip },
    }),
  );
}

async function joinLobby(stub: DurableObjectStub, p: Identity, extra = {}) {
  const c = await connectLobby(stub);
  c.send(joinFrame(p, extra));
  return c;
}

async function waitingIn(stub: DurableObjectStub, p: Identity, extra = {}) {
  const c = await joinLobby(stub, p, extra);
  await c.next("waiting");
  return c;
}

function openSockets(stub: DurableObjectStub) {
  return runInDurableObject(
    stub,
    (_i, state) =>
      state.getWebSockets().filter((ws) => ws.readyState === WebSocket.OPEN)
        .length,
  );
}

async function eventually(check: () => Promise<boolean>, label: string) {
  for (let i = 0; i < 200; i += 1) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`never became true: ${label}`);
}

/** Moves every waiter's deadlines into the past, as if the clock ran on. */
function expireWaiters(stub: DurableObjectStub, field: "fallbackAt" | "all") {
  return runInDurableObject(stub, (_i, state) => {
    for (const ws of state.getWebSockets()) {
      const att = ws.deserializeAttachment() as {
        state: string;
        waiter?: { fallbackAt: number; enqueuedAt: number };
      };
      if (att.state !== "waiting" || !att.waiter) continue;
      att.waiter.fallbackAt = 0;
      if (field === "all") att.waiter.enqueuedAt = 0;
      ws.serializeAttachment(att);
    }
  });
}

describe("ChatLobby", () => {
  it("pairs two clients that share an interest into a working room", async () => {
    const lobby = newLobby();
    const ana = person(["music", "film"]);
    const ben = person(["film"]);
    const a = await waitingIn(lobby, ana);
    const b = await joinLobby(lobby, ben);

    const [ma, mb] = await Promise.all([a.next("matched"), b.next("matched")]);
    expect(ma.matchId).toBe(mb.matchId);
    expect(ma.viaInvite).toBe(false);
    expect(await a.closeCode()).toBe(CLOSE.NORMAL);
    expect(await b.closeCode()).toBe(CLOSE.NORMAL);

    // The room was initialized with these two seats.
    const room = await authRoom(roomStub(ma.matchId), ana);
    const sync = await room.next("sync");
    expect(sync.meta.partner?.alias).toBe(ben.alias);
    expect(sync.meta.partner?.sharedInterests).toEqual(["film"]);
  });

  it("pairs an invite join with the host whose code derives from its secret", async () => {
    const lobby = newLobby();
    const host = person(["host-only"]);
    const guest = person(["guest-only"]);
    const h = await waitingIn(lobby, host);
    const g = await joinLobby(lobby, guest, {
      joinCode: await inviteCodeFor(host.secret),
    });

    const [mh, mg] = await Promise.all([h.next("matched"), g.next("matched")]);
    expect(mg.matchId).toBe(mh.matchId);
    expect(mg.viaInvite).toBe(true);
  });

  it("ignores a client-supplied inviteCode, so a code can't be squatted", async () => {
    const lobby = newLobby();
    const victimCode = await inviteCodeFor(uid());
    const squatter = await waitingIn(lobby, person(["squat"]), {
      inviteCode: victimCode,
    });
    const guest = await waitingIn(lobby, person(["guest"]), {
      joinCode: victimCode,
    });

    expect(squatter.frames.map((f) => f.t)).toEqual(["waiting"]);
    expect(guest.frames.map((f) => f.t)).toEqual(["waiting"]);
  });

  it("drops a waiter from the pool when its socket closes", async () => {
    const lobby = newLobby();
    const a = await waitingIn(lobby, person(["shared"]));
    a.close();
    await eventually(
      async () => (await openSockets(lobby)) === 0,
      "lobby saw the close",
    );

    const b = await waitingIn(lobby, person(["shared"]));
    expect(b.frames.map((f) => f.t)).toEqual(["waiting"]);
  });

  it("pairs waiters with no shared interest once the fallback is due", async () => {
    const lobby = newLobby();
    const a = await waitingIn(lobby, person(["only-a"]));
    const b = await waitingIn(lobby, person(["only-b"]));
    expect(a.frames.some((f) => f.t === "matched")).toBe(false);

    await expireWaiters(lobby, "fallbackAt");
    expect(await runDurableObjectAlarm(lobby)).toBe(true);

    const [ma, mb] = await Promise.all([a.next("matched"), b.next("matched")]);
    expect(ma.matchId).toBe(mb.matchId);
    expect(ma.viaInvite).toBe(false);
  });

  it("closes a waiter that outlived the queue cap with 4408", async () => {
    const lobby = newLobby();
    const a = await waitingIn(lobby, person(["lonely"]));
    await expireWaiters(lobby, "all");
    await runDurableObjectAlarm(lobby);
    expect(await a.closeCode()).toBe(CLOSE.QUEUE_TIMEOUT);
  });

  it("lets a second tab with the same secret supersede the first", async () => {
    const lobby = newLobby();
    const ana = person(["tabs"]);
    const first = await waitingIn(lobby, ana);
    const second = await waitingIn(lobby, ana);
    expect(await first.closeCode()).toBe(CLOSE.SUPERSEDED);

    const partner = await joinLobby(lobby, person(["tabs"]));
    const [m2, mp] = await Promise.all([
      second.next("matched"),
      partner.next("matched"),
    ]);
    expect(m2.matchId).toBe(mp.matchId);
  });

  it("rejects a same-sessionId join with the wrong secret and keeps the owner queued", async () => {
    const lobby = newLobby();
    const ana = person(["owner"]);
    const owner = await waitingIn(lobby, ana);
    const thief = await joinLobby(lobby, { ...ana, secret: uid() });
    expect(await thief.closeCode()).toBe(CLOSE.UNAUTHORIZED);
    expect(owner.closed).toBeNull();

    const partner = await joinLobby(lobby, person(["owner"]));
    const [mo, mp] = await Promise.all([
      owner.next("matched"),
      partner.next("matched"),
    ]);
    expect(mo.matchId).toBe(mp.matchId);
  });

  it("closes a malformed join with 4400", async () => {
    const c = await connectLobby(newLobby());
    c.send("{not json");
    expect(await c.closeCode()).toBe(CLOSE.BAD_FRAME);
  });

  it("closes an old protocol version with 4426", async () => {
    const c = await connectLobby(newLobby());
    c.send({ ...joinFrame(person(["x"])), v: PROTOCOL_VERSION + 1 });
    expect(await c.closeCode()).toBe(CLOSE.VERSION);
  });

  it("caps sockets per IP", async () => {
    const lobby = newLobby();
    for (let i = 0; i < 5; i += 1) await connectLobby(lobby, "shared-ip");
    const sixth = await connectLobby(lobby, "shared-ip");
    expect(await sixth.closeCode()).toBe(CLOSE.TOO_MANY);
  });

  it("aborts the room and requeues the survivor when a side drops mid-creation", async () => {
    const lobby = newLobby();
    const host = person(["abort"]);
    const h = await waitingIn(lobby, host);
    let matchId = "";
    // Wraps the room namespace so the host's socket closes while init is in
    // flight, the window the lobby has to handle.
    await runInDurableObject(lobby, (instance, state) => {
      const real = (instance as unknown as { env: typeof env }).env;
      const ns = real.CHAT_ROOM;
      const CHAT_ROOM = {
        idFromName: (name: string) => {
          matchId = name;
          return ns.idFromName(name);
        },
        get: (
          id: DurableObjectId,
          opts?: DurableObjectNamespaceGetDurableObjectOptions,
        ) => {
          const room = ns.get(id, opts);
          return {
            init: async (input: Parameters<ChatRoom["init"]>[0]) => {
              await room.init(input);
              for (const ws of state.getWebSockets()) {
                const att = ws.deserializeAttachment() as {
                  waiter?: { sessionId: string };
                };
                if (att.waiter?.sessionId === host.sessionId) ws.close(1000);
              }
            },
            abort: () => room.abort(),
          };
        },
      };
      Object.assign(instance, { env: { ...real, CHAT_ROOM } });
    });

    const survivor = await joinLobby(lobby, person(["abort"]));
    await h.closeCode();
    expect(matchId).not.toBe("");
    // The host's close lands before the lobby gets to abort().
    await eventually(
      async () => (await userTables(roomStub(matchId))).length === 0,
      "the half-created room was aborted",
    );
    expect(survivor.frames.some((f) => f.t === "matched")).toBe(false);

    const next = await joinLobby(lobby, person(["abort"]));
    const [ms, mn] = await Promise.all([
      survivor.next("matched"),
      next.next("matched"),
    ]);
    expect(ms.matchId).toBe(mn.matchId);
  });
});

// --- Room -------------------------------------------------------------------

const roomStub = (matchId: string) =>
  env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName(matchId));

async function connectRoom(stub: DurableObjectStub<ChatRoom>) {
  return new Client(
    await stub.fetch("https://chat.test/", {
      headers: { Upgrade: "websocket" },
    }),
  );
}

async function authRoom(stub: DurableObjectStub<ChatRoom>, p: Identity) {
  const c = await connectRoom(stub);
  c.send({
    t: "auth",
    v: PROTOCOL_VERSION,
    sessionId: p.sessionId,
    secret: p.secret,
  });
  return c;
}

async function newRoom() {
  const matchId = uid();
  const stub = roomStub(matchId);
  const ana = person(["music", "film"], "Ana");
  const ben = person(["film"], "Ben");
  const seat = async ({ secret, sessionId, ...rest }: Identity) => ({
    ...rest,
    sessionId,
    secretHash: await hashSecret(secret),
  });
  await stub.init({ matchId, a: await seat(ana), b: await seat(ben) });
  return { matchId, stub, ana, ben };
}

/** Both sides authenticated and synced. */
async function liveRoom() {
  const room = await newRoom();
  const a = await authRoom(room.stub, room.ana);
  await a.next("sync");
  const b = await authRoom(room.stub, room.ben);
  await b.next("sync");
  return { ...room, a, b };
}

let opSeq = 0;
/** Sends an op and resolves with its ack or err. */
async function op(c: Client, frame: { t: string } & Record<string, unknown>) {
  opSeq += 1;
  const id = `op-${opSeq}`;
  const from = c.raw.length;
  c.send({ ...frame, id });
  return Promise.race([
    c.next("ack", (f) => f.id === id, from),
    c.next("err", (f) => f.id === id, from),
  ]);
}

/** A no-op round trip (a blank send is acked and never stored): every frame
 *  the room sent this socket before the ack has arrived once this resolves. */
const barrier = (c: Client) => op(c, { t: "send", text: "" });

function dueNow(stub: DurableObjectStub<ChatRoom>, kind: string) {
  return runInDurableObject(stub, (_i, state) => {
    state.storage.sql.exec("UPDATE timers SET at = 0 WHERE kind = ?", kind);
  });
}

function timerKinds(stub: DurableObjectStub<ChatRoom>) {
  return runInDurableObject(stub, (_i, state) =>
    state.storage.sql
      .exec<{ kind: string }>("SELECT kind FROM timers ORDER BY kind")
      .toArray()
      .map((r) => r.kind),
  );
}

function userTables(stub: DurableObjectStub<ChatRoom>) {
  return runInDurableObject(stub, (_i, state) =>
    state.storage.sql
      .exec<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'",
      )
      .toArray()
      .map((r) => r.name),
  );
}

const getAlarm = (stub: DurableObjectStub<ChatRoom>) =>
  runInDurableObject(stub, (_i, state) => state.storage.getAlarm());

const messageRows = (stub: DurableObjectStub<ChatRoom>) =>
  runInDurableObject(
    stub,
    (_i, state) =>
      state.storage.sql
        .exec<{ n: number }>("SELECT COUNT(*) AS n FROM messages")
        .one().n,
  );

describe("ChatRoom", () => {
  it("closes a bad secret with 4401", async () => {
    const { stub, ana } = await newRoom();
    const c = await authRoom(stub, { ...ana, secret: uid() });
    expect(await c.closeCode()).toBe(CLOSE.UNAUTHORIZED);
  });

  it("closes an unknown room with 4404 and writes nothing", async () => {
    const stub = roomStub(uid());
    const c = await connectRoom(stub);
    expect(await c.closeCode()).toBe(CLOSE.GONE);
    expect(await userTables(stub)).toEqual([]);
    expect(await getAlarm(stub)).toBeNull();
  });

  it("syncs meta and history, then relays a send with an ack", async () => {
    const { stub, ana, ben, a, b } = await liveRoom();
    const res = await op(a, { t: "send", text: "hello ben" });
    expect(res.t).toBe("ack");

    const msgs = await b.next("msgs");
    expect(msgs.messages).toMatchObject([
      { author: "partner", text: "hello ben" },
    ]);

    const again = await authRoom(stub, ben);
    const sync = await again.next("sync");
    expect(sync.meta.self.alias).toBe(ben.alias);
    expect(sync.meta.partner).toMatchObject({
      alias: ana.alias,
      status: "online",
    });
    expect(sync.messages).toMatchObject([
      { author: "partner", text: "hello ben" },
    ]);
  });

  it("never sends a hidden whisper's text to the recipient", async () => {
    const { a, b } = await liveRoom();
    const secretText = `whisper-${uid()}`;
    await op(a, { t: "send", text: secretText, whisper: true });
    const hidden = await b.next("msgs");
    expect(hidden.messages[0]?.whisper?.state).toBe("hidden");
    await barrier(b);
    expect(b.raw.some((r) => r.includes(secretText))).toBe(false);

    await op(b, { t: "viewWhisper", messageId: hidden.messages[0]?.id });
    const shown = await b.next("msgs", (f) =>
      f.messages.some((m) => m.whisper?.state === "revealed"),
    );
    expect(shown.messages[0]?.text).toBe(secretText);
  });

  it("burns a revealed whisper when its timer runs", async () => {
    const { stub, a, b } = await liveRoom();
    const secretText = `whisper-${uid()}`;
    await op(a, { t: "send", text: secretText, whisper: true });
    const hidden = await b.next("msgs");
    await op(b, { t: "viewWhisper", messageId: hidden.messages[0]?.id });

    await dueNow(stub, "burn");
    await runDurableObjectAlarm(stub);
    const burned = await a.next("msgs", (f) =>
      f.messages.some((m) => m.whisper?.state === "burned"),
    );
    expect(burned.messages[0]?.text).toBe("");
    expect(
      await runInDurableObject(
        stub,
        (_i, state) =>
          state.storage.sql
            .exec<{ text: string }>("SELECT text FROM messages")
            .one().text,
      ),
    ).toBe("");
  });

  it("withholds the partner's game pick until both have answered", async () => {
    const { a, b } = await liveRoom();
    expect((await op(a, { t: "dealCard", cardId: "tot-coffee" })).t).toBe(
      "ack",
    );
    await op(a, { t: "answerCard", cardId: "tot-coffee", pick: "A" });
    await b.next("meta", (f) => f.meta.game?.partnerAnswered === true);
    await barrier(b);
    for (const r of b.raw) {
      expect(r).not.toContain("partnerPick");
      expect(r).not.toContain("answerA");
    }

    await op(b, { t: "answerCard", cardId: "tot-coffee", pick: "B" });
    const done = await b.next("meta", (f) => f.meta.game?.selfPick === "B");
    expect(done.meta.game?.partnerPick).toBe("A");
  });

  it("withholds the partner's reveal handle until both have submitted", async () => {
    const { a, b } = await liveRoom();
    await op(a, { t: "stayConnected" });
    await op(b, { t: "stayConnected" });
    const handle = `@ana_${uid().slice(0, 8)}`;
    expect((await op(a, { t: "submitReveal", handle })).t).toBe("ack");
    await b.next("meta", (f) => f.meta.reveal.partner.submitted);
    await barrier(b);
    expect(b.raw.some((r) => r.includes(handle))).toBe(false);

    await op(b, { t: "submitReveal", handle: "@ben" });
    const both = await b.next("meta", (f) => f.meta.reveal.self.submitted);
    expect(both.meta.reveal.partner.handle).toBe(handle);
  });

  it("never puts a session id or secret on the wire", async () => {
    const { ana, ben, a, b } = await liveRoom();
    await op(a, { t: "send", text: "hi" });
    await op(b, { t: "react", messageId: "1", emoji: "❤️" });
    await op(a, { t: "stayConnected" });
    await op(b, { t: "stayConnected" });
    await op(a, { t: "submitReveal", handle: "@ana" });
    await op(b, { t: "submitReveal", handle: "@ben" });
    await op(a, { t: "leave" });
    await barrier(b);
    const credentials = [ana.sessionId, ana.secret, ben.sessionId, ben.secret];
    for (const r of [...a.raw, ...b.raw]) {
      for (const cred of credentials) expect(r).not.toContain(cred);
    }
  });

  it("relays typing to the partner only", async () => {
    const { a, b } = await liveRoom();
    a.send({ t: "typing", on: true });
    expect(await b.next("typing")).toEqual({ t: "typing", on: true });
    await barrier(a);
    expect(a.frames.some((f) => f.t === "typing")).toBe(false);
  });

  it("shows a dropped partner as away, then ends the match after the grace", async () => {
    const { stub, a, b } = await liveRoom();
    const from = a.raw.length;
    b.close();
    const away = await a.next(
      "meta",
      (f) => f.meta.partner?.status === "away",
      from,
    );
    expect(away.meta.phase).toBe("active");
    expect(await timerKinds(stub)).toContain("away");

    await dueNow(stub, "away");
    await runDurableObjectAlarm(stub);
    const ended = await a.next("meta", (f) => f.meta.phase === "ended");
    expect(ended.meta.endedReason).toBe("partner-left");
    expect(await timerKinds(stub)).toEqual(["purge"]);
  });

  it("cancels the away grace when the partner reconnects", async () => {
    const { stub, ben, a, b } = await liveRoom();
    b.close();
    await a.next("meta", (f) => f.meta.partner?.status === "away");

    const from = a.raw.length;
    const back = await authRoom(stub, ben);
    await back.next("sync");
    await a.next("meta", (f) => f.meta.partner?.status === "online", from);
    expect(await timerKinds(stub)).not.toContain("away");
  });

  it("ends a match whose partner never connects once the start grace runs out", async () => {
    const { stub, ana } = await newRoom();
    const a = await authRoom(stub, ana);
    const sync = await a.next("sync");
    expect(sync.meta.partner?.status).toBe("online");

    await dueNow(stub, "start");
    await runDurableObjectAlarm(stub);
    const ended = await a.next("meta", (f) => f.meta.phase === "ended");
    expect(ended.meta.endedReason).toBe("partner-left");
  });

  it("acks a send with the stored message id", async () => {
    const { a, b } = await liveRoom();
    const ack = await op(a, { t: "send", text: "hey" });
    const msgs = await b.next("msgs");
    expect(ack).toMatchObject({ t: "ack", messageId: msgs.messages[0]?.id });
  });

  it("shows a message's send op id to its author only", async () => {
    const { stub, ana, ben, a } = await liveRoom();
    a.send({ t: "send", id: "op-visible", text: "mine" });
    await a.next("ack", (f) => f.id === "op-visible");
    const author = await authRoom(stub, ana);
    const partner = await authRoom(stub, ben);
    const [mine] = (await author.next("sync")).messages;
    const [theirs] = (await partner.next("sync")).messages;
    expect(mine?.clientId).toBe("op-visible");
    expect(theirs).not.toHaveProperty("clientId");
  });

  it("answers a retried send with the original message instead of a duplicate", async () => {
    const { stub, a } = await liveRoom();
    const frame = { t: "send", id: "retry-me", text: "once" };
    a.send(frame);
    const first = await a.next("ack", (f) => f.id === "retry-me");
    const from = a.raw.length;
    a.send(frame);
    const second = await a.next("ack", (f) => f.id === "retry-me", from);
    expect(second.messageId).toBe(first.messageId);
    expect(await messageRows(stub)).toBe(1);
  });

  it("ends a match left idle past the cap at the next sweep", async () => {
    const { stub, a, b } = await liveRoom();
    expect((await op(a, { t: "send", text: "hello?" })).t).toBe("ack");
    await runInDurableObject(stub, (_i, state) => {
      state.storage.sql.exec("UPDATE messages SET created_at = 0");
    });
    await dueNow(stub, "sweep");
    await runDurableObjectAlarm(stub);
    const ended = await b.next("meta", (f) => f.meta.phase === "ended");
    expect(ended.meta.endedReason).toBe("partner-left");
  });

  it("keeps a recently active match and re-arms its sweep", async () => {
    const { stub, a } = await liveRoom();
    expect((await op(a, { t: "send", text: "still here" })).t).toBe("ack");
    await dueNow(stub, "sweep");
    await runDurableObjectAlarm(stub);
    await barrier(a);
    expect(await timerKinds(stub)).toContain("sweep");
    expect(a.raw.some((f) => f.includes('"phase":"ended"'))).toBe(false);
  });

  it("refuses sockets past the per-room cap", async () => {
    const { stub } = await newRoom();
    for (let i = 0; i < MAX_ROOM_SOCKETS; i += 1) await connectRoom(stub);
    const extra = await connectRoom(stub);
    expect(await extra.closeCode()).toBe(CLOSE.TOO_MANY);
  });

  it("tells the leaver self-ended and the partner partner-left", async () => {
    const { a, b } = await liveRoom();
    expect((await op(a, { t: "leave" })).t).toBe("ack");
    const mine = await a.next("meta", (f) => f.meta.phase === "ended");
    const theirs = await b.next("meta", (f) => f.meta.phase === "ended");
    expect(mine.meta.endedReason).toBe("self-ended");
    expect(theirs.meta.endedReason).toBe("partner-left");
  });

  it("purges after the end: closes sockets with 4404 and leaves no storage", async () => {
    const { stub, ana, a, b } = await liveRoom();
    await op(a, { t: "send", text: "bye" });
    await op(a, { t: "leave" });
    await dueNow(stub, "purge");
    await runDurableObjectAlarm(stub);

    expect(await a.closeCode()).toBe(CLOSE.GONE);
    expect(await b.closeCode()).toBe(CLOSE.GONE);
    expect(await userTables(stub)).toEqual([]);
    expect(await getAlarm(stub)).toBeNull();

    const back = await authRoom(stub, ana);
    expect(await back.closeCode()).toBe(CLOSE.GONE);
  });

  it("rebuilds from storage after its in-memory caches are wiped", async () => {
    const { stub, ben, a, b } = await liveRoom();
    await op(a, { t: "send", text: "before" });
    await op(a, { t: "stayConnected" });

    await runInDurableObject(stub, (instance) => {
      Object.assign(instance, {
        creds: undefined,
        match: undefined,
        counts: undefined,
        alarmAt: undefined,
      });
    });

    expect((await op(b, { t: "stayConnected" })).t).toBe("ack");
    const unlocked = await b.next("meta", (f) => f.meta.reveal.unlocked);
    expect(unlocked.meta.stayConnected).toEqual({ self: true, partner: true });
    await op(b, { t: "send", text: "after" });
    await a.next("msgs", (f) => f.messages[0]?.text === "after");

    const again = await authRoom(stub, ben);
    const sync = await again.next("sync");
    expect(sync.messages.map((m) => m.text)).toEqual(["before", "after"]);
  });

  it("keeps both sides connected and authenticated across an eviction", async () => {
    const { stub, a, b } = await liveRoom();
    await op(a, { t: "send", text: "before" });
    await evictDurableObject(stub);

    expect((await op(b, { t: "send", text: "after" })).t).toBe("ack");
    const got = await a.next("msgs", (f) => f.messages[0]?.text === "after");
    expect(got.messages[0]).toMatchObject({ author: "partner", id: "2" });
  });

  it("rate-limits a burst of sends without writing the extras", async () => {
    const { stub, a } = await liveRoom();
    const burst = LIMITS.sendMessage.capacity + 2;
    const results = await Promise.all(
      Array.from({ length: burst }, (_, i) =>
        op(a, { t: "send", text: `m${i}` }),
      ),
    );
    const limited = results.filter(
      (r) => r.t === "err" && r.code === "rate_limited",
    );
    expect(limited.length).toBe(2);
    expect(await messageRows(stub)).toBe(LIMITS.sendMessage.capacity);
  });

  // Every setAlarm is a billed row write plus an invocation, so the room may
  // only call it when the earliest deadline actually moves.
  it("writes the alarm only when a timer moves it, never on a send", async () => {
    const { stub, a, b } = await liveRoom();
    const before = await getAlarm(stub);
    expect(before).not.toBeNull();
    const writes: (number | Date)[] = [];
    await runInDurableObject(stub, (_i, state) => {
      const setAlarm = state.storage.setAlarm.bind(state.storage);
      state.storage.setAlarm = (at, opts) => {
        writes.push(at);
        return setAlarm(at, opts);
      };
    });

    await op(a, { t: "send", text: "plain" });
    await op(b, { t: "send", text: "reply" });
    await op(a, { t: "react", messageId: "2", emoji: "❤️" });
    a.send({ t: "typing", on: true });
    await b.next("typing");
    expect(writes).toEqual([]);
    expect(await getAlarm(stub)).toBe(before);

    await op(a, { t: "send", text: "psst", whisper: true });
    const hidden = await b.next("msgs", (f) => f.messages[0]?.text === "");
    await op(b, { t: "viewWhisper", messageId: hidden.messages[0]?.id });
    expect(writes).toHaveLength(1);
    expect(await getAlarm(stub)).toBeLessThan(before ?? 0);
  });
});
