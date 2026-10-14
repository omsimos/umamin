import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomServerFrame } from "@/lib/chat/protocol";
import {
  type ChatMessage,
  IDLE_SNAPSHOT,
  LOADING_SNAPSHOT,
  type SelfIdentity,
  type SessionSnapshot,
  type SnapshotMeta,
} from "@/lib/chat/types";
import type { WebSocketLike } from "@/lib/realtime/socket";
import {
  createWsTransport,
  LEAVE_ACK_TIMEOUT_MS,
  MATCH_ID_KEY,
  MAX_FAILED_CONNECTS,
  MAX_QUEUED_SENDS,
  QUEUE_TIMEOUT_MESSAGE,
  RATE_LIMITED_MESSAGE,
  TYPING_REFRESH_MS,
  TYPING_STALE_MS,
} from "./ws-transport";

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

  // Server side.
  open() {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }

  push(frame: unknown) {
    this.onmessage?.({ data: JSON.stringify(frame) } as MessageEvent);
  }

  serverClose(code: number) {
    this.readyState = 3;
    this.onclose?.({ code } as CloseEvent);
  }

  /** Client frames, parsed. Keepalive pings are skipped. */
  frames(): Record<string, unknown>[] {
    return this.sent.filter((s) => s !== "ping").map((s) => JSON.parse(s));
  }
}

const credentials = { sessionId: "s1", sessionSecret: "s1-secret" };
const SELF: SelfIdentity = {
  alias: "NightOwl",
  avatarSeed: "seed",
  interests: ["music"],
};
const MATCH = "0b7e5a52-8d5e-4f7b-9b2a-0c6f1e2d3a4b";
const MATCH_2 = "1c8f6b63-9e6f-4a8c-8c3b-1d7a2f3e4b5c";

function meta(overrides: Partial<SnapshotMeta> = {}): SnapshotMeta {
  const { messages: _m, ...idle } = IDLE_SNAPSHOT;
  return {
    ...idle,
    phase: "active",
    matchId: MATCH,
    self: SELF,
    partner: {
      alias: "Stranger",
      avatarSeed: "p-seed",
      sharedInterests: ["music"],
      status: "online",
    },
    ...overrides,
  };
}

function msg(
  id: string,
  author: "self" | "partner",
  text: string,
  extra: Partial<ChatMessage> = {},
): ChatMessage {
  return { id, author, text, ts: Number(id), reactions: [], ...extra };
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

function setup(stored: Record<string, string> = {}) {
  const storage = memoryStorage(stored);
  const onError = vi.fn();
  const onRateLimited = vi.fn();
  const reload = vi.fn((): boolean | undefined => true);
  const t = createWsTransport({
    credentials,
    onError,
    onRateLimited,
    baseUrl: "https://www.umamin.link",
    WebSocketImpl: FakeWebSocket,
    storage,
    reload,
    random: () => 1,
  });
  const seen: SessionSnapshot[] = [];
  t.subscribe((s) => seen.push(s));
  const last = () => FakeWebSocket.instances.at(-1) as FakeWebSocket;
  return { t, storage, onError, onRateLimited, reload, seen, last };
}

/** Matching through the lobby into a synced, active room. */
function activeRoom(
  ctx: ReturnType<typeof setup>,
  messages: ChatMessage[] = [],
) {
  ctx.t.findMatch(SELF);
  const lobby = ctx.last();
  lobby.open();
  lobby.push({ t: "matched", matchId: MATCH, viaInvite: false });
  const room = ctx.last();
  room.open();
  room.push({ t: "sync", meta: meta(), messages });
  return { lobby, room };
}

function sentOps(room: FakeWebSocket) {
  return room.frames().filter((f) => f.t !== "auth");
}

describe("wsTransport", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
  });
  afterEach(() => vi.useRealTimers());

  describe("matching", () => {
    it("starts idle and opens nothing without a stored match", () => {
      const { t } = setup();
      expect(t.getSnapshot()).toBe(IDLE_SNAPSHOT);
      expect(FakeWebSocket.instances).toHaveLength(0);
    });

    it("reports matching the instant findMatch is called and joins over wss", () => {
      const { t, last } = setup();
      t.findMatch(SELF);
      expect(t.getSnapshot().phase).toBe("matching");
      expect(t.getSnapshot().self).toBe(SELF);
      expect(last().url).toBe("wss://www.umamin.link/api/chat/lobby");
      last().open();
      expect(last().frames()).toEqual([
        {
          t: "join",
          v: 1,
          sessionId: "s1",
          secret: "s1-secret",
          alias: "NightOwl",
          avatarSeed: "seed",
          interests: ["music"],
        },
      ]);
    });

    it("uses ws: for an http base url", () => {
      FakeWebSocket.instances = [];
      const t = createWsTransport({
        credentials,
        onError: vi.fn(),
        onRateLimited: vi.fn(),
        baseUrl: "http://localhost:3000",
        WebSocketImpl: FakeWebSocket,
        storage: memoryStorage(),
      });
      t.findMatch(SELF);
      expect(FakeWebSocket.instances[0].url).toBe(
        "ws://localhost:3000/api/chat/lobby",
      );
    });

    it("keeps matching while waiting", () => {
      const { t, last, seen } = setup();
      t.findMatch(SELF);
      const before = t.getSnapshot();
      last().open();
      last().push({ t: "waiting", since: 1 });
      expect(t.getSnapshot()).toBe(before);
      expect(seen).toHaveLength(1);
    });

    it("forwards a join code and reports a miss only when the invite failed", () => {
      const { t, last } = setup();
      const onInviteMiss = vi.fn();
      t.findMatch(SELF, { joinCode: "theirs", onInviteMiss });
      last().open();
      expect(last().frames()[0]).toMatchObject({ joinCode: "theirs" });
      last().push({ t: "matched", matchId: MATCH, viaInvite: false });
      expect(onInviteMiss).toHaveBeenCalledTimes(1);

      const hit = vi.fn();
      t.findMatch(SELF, { joinCode: "theirs", onInviteMiss: hit });
      const lobby = last();
      lobby.open();
      lobby.push({ t: "matched", matchId: MATCH_2, viaInvite: true });
      expect(hit).not.toHaveBeenCalled();
    });

    it("does not report a miss without a join code", () => {
      const { t, last } = setup();
      const onInviteMiss = vi.fn();
      t.findMatch(SELF, { onInviteMiss });
      last().open();
      expect(last().frames()[0]).not.toHaveProperty("joinCode");
      last().push({ t: "matched", matchId: MATCH, viaInvite: false });
      expect(onInviteMiss).not.toHaveBeenCalled();
    });

    it("moves from the lobby to the room on matched and goes active on sync", () => {
      const { t, last, storage } = setup();
      t.findMatch(SELF);
      const lobby = last();
      lobby.open();
      lobby.push({ t: "matched", matchId: MATCH, viaInvite: false });
      expect(lobby.closedWith).toBe(1000);
      const room = last();
      expect(room.url).toBe(`wss://www.umamin.link/api/chat/room/${MATCH}`);
      expect(storage.data.get(MATCH_ID_KEY)).toBe(MATCH);
      // No meta yet: still the radar, not a loading flash.
      expect(t.getSnapshot().phase).toBe("matching");
      room.open();
      expect(room.frames()).toEqual([
        { t: "auth", v: 1, sessionId: "s1", secret: "s1-secret" },
      ]);
      room.push({
        t: "sync",
        meta: meta(),
        messages: [msg("1", "partner", "hi")],
      });
      const snap = t.getSnapshot();
      expect(snap.phase).toBe("active");
      expect(snap.matchId).toBe(MATCH);
      expect(snap.partner?.alias).toBe("Stranger");
      expect(snap.messages.map((m) => m.text)).toEqual(["hi"]);
    });

    it("re-sends join after the lobby socket drops", () => {
      const { t, last } = setup();
      t.findMatch(SELF);
      last().open();
      last().serverClose(1006);
      vi.advanceTimersByTime(250);
      last().open();
      expect(FakeWebSocket.instances).toHaveLength(2);
      expect(last().frames()[0]).toMatchObject({ t: "join" });
      expect(t.getSnapshot().phase).toBe("matching");
    });

    it("gives up on a lobby that never answers so the route can recover", () => {
      const { t, last, onError } = setup();
      t.findMatch(SELF);
      for (let i = 0; i < MAX_FAILED_CONNECTS; i++) {
        last().serverClose(1006);
        vi.advanceTimersByTime(5_000);
      }
      expect(t.getSnapshot()).toBe(IDLE_SNAPSHOT);
      expect(onError).toHaveBeenCalledWith(expect.any(String));
      expect(FakeWebSocket.instances).toHaveLength(MAX_FAILED_CONNECTS);
    });

    it("leave() on the radar closes the lobby and goes idle at once", () => {
      const { t, last } = setup();
      t.findMatch(SELF);
      last().open();
      t.leave();
      expect(last().closedWith).toBe(1000);
      expect(t.getSnapshot()).toBe(IDLE_SNAPSHOT);
      vi.advanceTimersByTime(60_000);
      expect(FakeWebSocket.instances).toHaveLength(1);
    });
  });

  describe("room state", () => {
    it("is identity-stable across frames that change nothing", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx, [msg("1", "partner", "hi")]);
      const first = ctx.t.getSnapshot();
      room.push({ t: "meta", meta: meta() });
      room.push({ t: "msgs", messages: [msg("1", "partner", "hi")] });
      expect(ctx.t.getSnapshot()).toBe(first);
    });

    it("replaces meta and upserts messages by id", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx, [
        msg("1", "partner", "hi"),
        msg("2", "self", "hey"),
      ]);
      const untouched = ctx.t.getSnapshot().messages[1];
      room.push({
        t: "msgs",
        messages: [
          msg("1", "partner", "hi", {
            reactions: [{ emoji: "🔥", by: "self" }],
          }),
          msg("3", "partner", "what's up"),
        ],
      });
      room.push({
        t: "meta",
        meta: meta({ stayConnected: { self: false, partner: true } }),
      });
      const snap = ctx.t.getSnapshot();
      expect(snap.messages.map((m) => m.id)).toEqual(["1", "2", "3"]);
      expect(snap.messages[0].reactions).toEqual([{ emoji: "🔥", by: "self" }]);
      expect(snap.messages[1]).toBe(untouched);
      expect(snap.stayConnected.partner).toBe(true);
    });

    it("lets sync replace the whole state after a reconnect", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx, [msg("1", "partner", "old")]);
      room.serverClose(1006);
      vi.advanceTimersByTime(250);
      const again = ctx.last();
      again.open();
      expect(again.frames()[0]).toMatchObject({ t: "auth" });
      again.push({
        t: "sync",
        meta: meta({ vibe: { score: 40, level: 2 } }),
        messages: [msg("5", "partner", "new")],
      });
      const snap = ctx.t.getSnapshot();
      expect(snap.messages.map((m) => m.text)).toEqual(["new"]);
      expect(snap.vibe.level).toBe(2);
    });

    it("keeps showing the chat while reconnecting", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx, [msg("1", "partner", "hi")]);
      room.serverClose(1006);
      expect(ctx.t.getSnapshot().phase).toBe("active");
      expect(ctx.t.getSnapshot().messages).toHaveLength(1);
    });
  });

  describe("reload resume", () => {
    it("starts loading, connects to the stored room and resumes on sync", () => {
      const { t, last, seen } = setup({ [MATCH_ID_KEY]: MATCH });
      expect(t.getSnapshot()).toBe(LOADING_SNAPSHOT);
      expect(last().url).toBe(`wss://www.umamin.link/api/chat/room/${MATCH}`);
      last().open();
      last().push({
        t: "sync",
        meta: meta(),
        messages: [msg("1", "self", "still here")],
      });
      expect(t.getSnapshot().phase).toBe("active");
      expect(t.getSnapshot().self).toEqual(SELF);
      expect(seen.map((s) => s.phase)).toEqual(["active"]);
    });

    it("clears a gone match and goes idle on 4404", () => {
      const { t, last, storage } = setup({ [MATCH_ID_KEY]: MATCH });
      last().open();
      last().serverClose(4404);
      expect(t.getSnapshot()).toBe(IDLE_SNAPSHOT);
      expect(storage.data.has(MATCH_ID_KEY)).toBe(false);
      vi.advanceTimersByTime(60_000);
      expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it("ignores a stored value that isn't a match id", () => {
      const { t, storage } = setup({ [MATCH_ID_KEY]: "../../admin" });
      expect(t.getSnapshot()).toBe(IDLE_SNAPSHOT);
      expect(FakeWebSocket.instances).toHaveLength(0);
      expect(storage.data.has(MATCH_ID_KEY)).toBe(false);
    });

    it("gives up a resume whose room never answers", () => {
      const { t, last, storage } = setup({ [MATCH_ID_KEY]: MATCH });
      for (let i = 0; i < MAX_FAILED_CONNECTS; i++) {
        last().serverClose(1006);
        vi.advanceTimersByTime(5_000);
      }
      expect(t.getSnapshot()).toBe(IDLE_SNAPSHOT);
      expect(storage.data.has(MATCH_ID_KEY)).toBe(false);
    });
  });

  describe("typing", () => {
    it("merges partner typing into the status and expires it", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx);
      room.push({ t: "typing", on: true });
      expect(ctx.t.getSnapshot().partner?.status).toBe("typing");
      vi.advanceTimersByTime(TYPING_STALE_MS - 1);
      room.push({ t: "typing", on: true });
      vi.advanceTimersByTime(TYPING_STALE_MS - 1);
      expect(ctx.t.getSnapshot().partner?.status).toBe("typing");
      vi.advanceTimersByTime(1);
      expect(ctx.t.getSnapshot().partner?.status).toBe("online");
    });

    it("clears on an off frame and when the partner's message lands", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx);
      room.push({ t: "typing", on: true });
      room.push({ t: "typing", on: false });
      expect(ctx.t.getSnapshot().partner?.status).toBe("online");
      room.push({ t: "typing", on: true });
      room.push({ t: "msgs", messages: [msg("1", "partner", "yo")] });
      expect(ctx.t.getSnapshot().partner?.status).toBe("online");
    });

    it("never shows typing over an away partner", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx);
      room.push({ t: "typing", on: true });
      room.push({
        t: "meta",
        meta: meta({
          partner: {
            alias: "Stranger",
            avatarSeed: "p-seed",
            sharedInterests: ["music"],
            status: "away",
          },
        }),
      });
      expect(ctx.t.getSnapshot().partner?.status).toBe("away");
    });

    it("throttles own typing frames and sends off once", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx);
      ctx.t.setTyping(true);
      ctx.t.setTyping(true);
      vi.advanceTimersByTime(TYPING_REFRESH_MS - 1);
      ctx.t.setTyping(true);
      vi.advanceTimersByTime(1);
      ctx.t.setTyping(true);
      ctx.t.setTyping(false);
      ctx.t.setTyping(false);
      expect(sentOps(room)).toEqual([
        { t: "typing", on: true },
        { t: "typing", on: true },
        { t: "typing", on: false },
      ]);
    });

    it("never queues typing while disconnected", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx);
      room.serverClose(1006);
      ctx.t.setTyping(true);
      vi.advanceTimersByTime(250);
      const again = ctx.last();
      again.open();
      again.push({ t: "sync", meta: meta(), messages: [] });
      expect(sentOps(again)).toEqual([]);
    });
  });

  describe("sending", () => {
    it("forwards reply, whisper and effect options and omits absent ones", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx, [msg("9", "partner", "q")]);
      ctx.t.send("plain");
      ctx.t.send("re", { replyToId: "9" });
      ctx.t.send("psst", { whisper: true });
      ctx.t.send("yay", { effect: "confetti" });
      const sends = sentOps(room);
      expect(sends[0]).toEqual({
        t: "send",
        id: expect.any(String),
        text: "plain",
      });
      expect(sends[1]).toMatchObject({ text: "re", replyTo: "9" });
      expect(sends[2]).toMatchObject({ text: "psst", whisper: true });
      expect(sends[3]).toMatchObject({ text: "yay", effect: "confetti" });
      expect(new Set(sends.map((s) => s.id)).size).toBe(4);
    });

    it("shows an optimistic bubble with cheap previews", () => {
      const ctx = setup();
      activeRoom(ctx, [msg("9", "partner", "question?")]);
      ctx.t.send("  answer  ", { replyToId: "9" });
      ctx.t.send("secret", { whisper: true, effect: "confetti" });
      const [, reply, whisper] = ctx.t.getSnapshot().messages;
      expect(reply).toMatchObject({
        author: "self",
        text: "answer",
        delivery: "sending",
        replyTo: { id: "9", author: "partner", text: "question?" },
      });
      expect(whisper.whisper).toEqual({ state: "hidden" });
      expect(whisper).not.toHaveProperty("effect");
    });

    it("ignores blank text", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx);
      ctx.t.send("   ");
      expect(sentOps(room)).toEqual([]);
      expect(ctx.t.getSnapshot().messages).toEqual([]);
    });

    it("uses a fresh uuid op id per send", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx);
      ctx.t.send("a");
      ctx.t.send("b");
      const [a, b] = sentOps(room).map((f) => f.id);
      expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-/);
      expect(b).not.toBe(a);
    });

    it("swaps the bubble for the row the ack names, once it arrives", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx, [msg("1", "partner", "hi")]);
      ctx.t.send("hello");
      const { id } = sentOps(room)[0];
      room.push({ t: "ack", id, messageId: "2" });
      // Acked but the row isn't here yet: the bubble stays.
      expect(ctx.t.getSnapshot().messages.map((m) => m.text)).toEqual([
        "hi",
        "hello",
      ]);
      // An unrelated row (another tab's) doesn't take the bubble's place.
      room.push({ t: "msgs", messages: [msg("3", "self", "other tab")] });
      expect(ctx.t.getSnapshot().messages).toHaveLength(3);
      room.push({ t: "msgs", messages: [msg("2", "self", "hello")] });
      expect(ctx.t.getSnapshot().messages).toEqual([
        msg("1", "partner", "hi"),
        msg("2", "self", "hello"),
        msg("3", "self", "other tab"),
      ]);
    });

    it("swaps at once on a dedupe ack for a row already in hand", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx, [msg("7", "self", "hello")]);
      ctx.t.send("hello");
      room.push({ t: "ack", id: sentOps(room)[0].id, messageId: "7" });
      expect(ctx.t.getSnapshot().messages).toEqual([msg("7", "self", "hello")]);
    });

    it("drops the bubble when the ack stored nothing", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx);
      ctx.t.send("late");
      room.push({ t: "ack", id: sentOps(room)[0].id });
      expect(ctx.t.getSnapshot().messages).toEqual([]);
    });

    it("doesn't confuse another tab's message with the pending one", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx);
      ctx.t.send("mine");
      room.push({ t: "msgs", messages: [msg("4", "self", "other tab")] });
      const messages = ctx.t.getSnapshot().messages;
      expect(messages.map((m) => [m.text, m.delivery])).toEqual([
        ["other tab", undefined],
        ["mine", "sending"],
      ]);
    });

    it("marks a rejected send failed and retries it", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx);
      ctx.t.send("hello");
      const first = sentOps(room)[0];
      room.push({ t: "err", id: first.id, code: "rate_limited" });
      const failed = ctx.t.getSnapshot().messages[0];
      expect(failed.delivery).toBe("failed");
      expect(ctx.onRateLimited).toHaveBeenCalledWith(RATE_LIMITED_MESSAGE);
      expect(ctx.onError).not.toHaveBeenCalled();

      ctx.t.retrySend(failed.id);
      const retry = sentOps(room)[1];
      expect(retry).toMatchObject({ t: "send", text: "hello" });
      // The same op id, so the room dedupes if the first one was stored.
      expect(retry.id).toBe(first.id);
      expect(ctx.t.getSnapshot().messages[0].delivery).toBe("sending");
      room.push({ t: "ack", id: retry.id, messageId: "1" });
      room.push({ t: "msgs", messages: [msg("1", "self", "hello")] });
      expect(ctx.t.getSnapshot().messages).toEqual([msg("1", "self", "hello")]);
    });

    it("re-queues an in-flight send on a drop and lands it once when the room already stored it", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx);
      ctx.t.send("hello");
      const first = sentOps(room)[0];
      room.serverClose(1006);
      expect(ctx.t.getSnapshot().messages[0].delivery).toBe("sending");
      vi.advanceTimersByTime(250);
      const again = ctx.last();
      again.open();
      // The room stored it before the drop, so the sync already has the row.
      again.push({
        t: "sync",
        meta: meta(),
        messages: [msg("1", "self", "hello")],
      });
      expect(sentOps(again)).toEqual([first]);
      again.push({ t: "ack", id: first.id, messageId: "1" });
      expect(ctx.t.getSnapshot().messages).toEqual([msg("1", "self", "hello")]);
    });

    it("retires a re-queued bubble at sync when its stored row carries the op id", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx);
      ctx.t.send("hello");
      const first = sentOps(room)[0];
      room.serverClose(1006);
      vi.advanceTimersByTime(250);
      const again = ctx.last();
      again.open();
      const stored = { ...msg("1", "self", "hello"), clientId: first.id };
      again.push({ t: "sync", meta: meta(), messages: [stored] });
      // No duplicate on screen, and nothing re-sent.
      expect(ctx.t.getSnapshot().messages).toEqual([stored]);
      expect(sentOps(again)).toEqual([]);
    });

    it("re-queues an in-flight send the room never got and delivers it after sync", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx);
      ctx.t.send("hello");
      const first = sentOps(room)[0];
      room.serverClose(1006);
      vi.advanceTimersByTime(250);
      const again = ctx.last();
      again.open();
      again.push({ t: "sync", meta: meta(), messages: [] });
      expect(sentOps(again)).toEqual([first]);
      again.push({ t: "ack", id: first.id, messageId: "1" });
      again.push({ t: "msgs", messages: [msg("1", "self", "hello")] });
      expect(ctx.t.getSnapshot().messages).toEqual([msg("1", "self", "hello")]);
    });

    it("fails pending sends when the room ends before they're delivered", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx);
      ctx.t.send("hello");
      room.push({ t: "meta", meta: meta({ phase: "ended" }) });
      room.serverClose(4404);
      expect(ctx.t.getSnapshot().phase).toBe("ended");
      expect(ctx.t.getSnapshot().messages[0].delivery).toBe("failed");
    });

    it("queues sends while disconnected and flushes them after sync", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx);
      room.serverClose(1006);
      ctx.t.send("one");
      ctx.t.send("two");
      expect(ctx.t.getSnapshot().messages.map((m) => m.delivery)).toEqual([
        "sending",
        "sending",
      ]);
      vi.advanceTimersByTime(250);
      const again = ctx.last();
      again.open();
      expect(sentOps(again)).toEqual([]);
      again.push({ t: "sync", meta: meta(), messages: [] });
      expect(sentOps(again).map((f) => f.text)).toEqual(["one", "two"]);
    });

    it("keeps a send's op id across repeated drops", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx);
      room.serverClose(1006);
      ctx.t.send("one");
      vi.advanceTimersByTime(250);
      const second = ctx.last();
      second.open();
      second.push({ t: "sync", meta: meta(), messages: [] });
      const flushed = sentOps(second)[0];
      second.serverClose(1006);
      expect(ctx.t.getSnapshot().messages[0].delivery).toBe("sending");
      vi.advanceTimersByTime(5_000);
      const third = ctx.last();
      third.open();
      third.push({ t: "sync", meta: meta(), messages: [] });
      expect(sentOps(third)).toEqual([flushed]);
    });

    it("caps the offline queue", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx);
      room.serverClose(1006);
      for (let i = 0; i <= MAX_QUEUED_SENDS; i++) ctx.t.send(`m${i}`);
      const deliveries = ctx.t.getSnapshot().messages.map((m) => m.delivery);
      expect(deliveries.filter((d) => d === "sending")).toHaveLength(
        MAX_QUEUED_SENDS,
      );
      expect(deliveries.at(-1)).toBe("failed");
    });

    it("drops an acked send at the drop and lets the sync bring it back", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx);
      ctx.t.send("hello");
      room.push({ t: "ack", id: sentOps(room)[0].id, messageId: "1" });
      room.serverClose(1006);
      vi.advanceTimersByTime(250);
      const again = ctx.last();
      again.open();
      again.push({
        t: "sync",
        meta: meta(),
        messages: [msg("1", "self", "hello")],
      });
      expect(ctx.t.getSnapshot().messages).toEqual([msg("1", "self", "hello")]);
      expect(sentOps(again)).toEqual([]);
    });
  });

  describe("ops and errors", () => {
    it("sends each op with its own id", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx, [msg("3", "partner", "w")]);
      ctx.t.react("3", "❤️");
      ctx.t.viewWhisper("3");
      ctx.t.dealCard("card-1", "guess");
      ctx.t.answerCard("card-1", "A");
      ctx.t.dismissGame();
      ctx.t.signalStayConnected();
      ctx.t.submitRevealHandle("@me");
      ctx.t.withdrawRevealHandle();
      const ops = sentOps(room);
      expect(ops.map(({ id: _id, ...rest }) => rest)).toEqual([
        { t: "react", messageId: "3", emoji: "❤️" },
        { t: "viewWhisper", messageId: "3" },
        { t: "dealCard", cardId: "card-1", mode: "guess" },
        { t: "answerCard", cardId: "card-1", pick: "A" },
        { t: "dismissGame" },
        { t: "stayConnected" },
        { t: "submitReveal", handle: "@me" },
        { t: "withdrawReveal" },
      ]);
      expect(new Set(ops.map((o) => o.id)).size).toBe(ops.length);
    });

    it("never sends an op against an unsent bubble", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx);
      ctx.t.send("x");
      const temp = ctx.t.getSnapshot().messages[0].id;
      ctx.t.react(temp, "❤️");
      ctx.t.send("y", { replyToId: temp });
      expect(sentOps(room).filter((f) => f.t === "react")).toEqual([]);
      expect(sentOps(room)[1]).not.toHaveProperty("replyTo");
    });

    it("routes rate limits to onRateLimited and other codes to onError", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx);
      ctx.t.dealCard("card-1");
      room.push({ t: "err", id: sentOps(room)[0].id, code: "rate_limited" });
      expect(ctx.onRateLimited).toHaveBeenCalledWith(RATE_LIMITED_MESSAGE);
      ctx.t.dealCard("card-9");
      room.push({ t: "err", id: sentOps(room)[1].id, code: "locked" });
      ctx.t.submitRevealHandle("@me");
      room.push({ t: "err", id: sentOps(room)[2].id, code: "invalid" });
      expect(ctx.onRateLimited).toHaveBeenCalledTimes(1);
      expect(ctx.onError.mock.calls.map(([m]) => m)).toEqual([
        expect.stringMatching(/vibe level/i),
        "Something went wrong. Please try again.",
      ]);
    });

    it("tells the user when an op can't go out while reconnecting", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx);
      room.serverClose(1006);
      ctx.t.signalStayConnected();
      expect(ctx.onError).toHaveBeenCalledTimes(1);
    });
  });

  describe("leaving", () => {
    it("sends leave, holds the view until the ack, then goes idle", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx);
      const active = ctx.t.getSnapshot();
      ctx.t.leave("self-ended");
      const leave = sentOps(room).at(-1);
      expect(leave).toMatchObject({ t: "leave" });
      // The room's ended meta must not flash the ended view for the leaver.
      room.push({
        t: "meta",
        meta: meta({ phase: "ended", endedReason: "self-ended" }),
      });
      room.push({ t: "ack", id: "unrelated" });
      expect(ctx.t.getSnapshot()).toBe(active);
      room.push({ t: "ack", id: leave?.id });
      expect(ctx.t.getSnapshot()).toBe(IDLE_SNAPSHOT);
      expect(room.closedWith).toBe(1000);
      expect(ctx.storage.data.has(MATCH_ID_KEY)).toBe(false);
    });

    it("closes anyway when the ack doesn't come within a second", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx);
      ctx.t.leave();
      vi.advanceTimersByTime(LEAVE_ACK_TIMEOUT_MS - 1);
      expect(room.closedWith).toBeUndefined();
      vi.advanceTimersByTime(1);
      expect(room.closedWith).toBe(1000);
      expect(ctx.t.getSnapshot()).toBe(IDLE_SNAPSHOT);
    });

    it("sequences a rematch without flashing the old chat or idle", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx, [msg("1", "partner", "bye")]);
      const lobbiesBefore = FakeWebSocket.instances.length;
      ctx.seen.length = 0;
      ctx.t.leave();
      ctx.t.findMatch(SELF);
      expect(ctx.t.getSnapshot().phase).toBe("matching");
      expect(ctx.t.getSnapshot().messages).toEqual([]);
      // The new search waits for the old room to be left.
      expect(FakeWebSocket.instances).toHaveLength(lobbiesBefore);
      room.push({ t: "meta", meta: meta({ phase: "ended" }) });
      room.push({ t: "ack", id: sentOps(room).at(-1)?.id });
      const lobby = ctx.last();
      expect(lobby.url).toMatch(/\/api\/chat\/lobby$/);
      lobby.open();
      lobby.push({ t: "matched", matchId: MATCH_2, viaInvite: false });
      ctx.last().open();
      ctx.last().push({
        t: "sync",
        meta: meta({ matchId: MATCH_2 }),
        messages: [],
      });
      expect(ctx.seen.map((s) => s.phase)).toEqual(["matching", "active"]);
      expect(ctx.t.getSnapshot().matchId).toBe(MATCH_2);
      expect(ctx.storage.data.get(MATCH_ID_KEY)).toBe(MATCH_2);
    });

    it("a cancelled rematch settles to idle", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx);
      ctx.t.leave();
      ctx.t.findMatch(SELF);
      ctx.t.leave();
      room.push({ t: "ack", id: sentOps(room).at(-1)?.id });
      expect(ctx.t.getSnapshot()).toBe(IDLE_SNAPSHOT);
      expect(FakeWebSocket.instances.at(-1)).toBe(room);
    });

    it("leaves right after matching once the room syncs", () => {
      const ctx = setup();
      ctx.t.findMatch(SELF);
      ctx.last().open();
      ctx.last().push({ t: "matched", matchId: MATCH, viaInvite: false });
      const room = ctx.last();
      ctx.t.leave();
      room.open();
      room.push({ t: "sync", meta: meta(), messages: [] });
      expect(sentOps(room)).toEqual([{ t: "leave", id: expect.any(String) }]);
    });
  });

  describe("close codes", () => {
    it("keeps the ended view after the room is purged", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx);
      room.push({
        t: "meta",
        meta: meta({
          phase: "ended",
          endedReason: "partner-left",
          reveal: {
            unlocked: true,
            self: { submitted: true, handle: "@me" },
            partner: { submitted: true, handle: "@them" },
          },
        }),
      });
      const ended = ctx.t.getSnapshot();
      room.serverClose(4404);
      expect(ctx.t.getSnapshot()).toBe(ended);
      expect(ctx.t.getSnapshot().reveal.partner.handle).toBe("@them");
      expect(ctx.storage.data.has(MATCH_ID_KEY)).toBe(false);
      vi.advanceTimersByTime(60_000);
      expect(ctx.t.getSnapshot()).toBe(ended);
      ctx.t.leave();
      expect(ctx.t.getSnapshot()).toBe(IDLE_SNAPSHOT);
    });

    it("holds the ended view instead of reconnecting after a drop", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx);
      room.push({ t: "meta", meta: meta({ phase: "ended" }) });
      const count = FakeWebSocket.instances.length;
      room.serverClose(1006);
      vi.advanceTimersByTime(60_000);
      expect(FakeWebSocket.instances).toHaveLength(count);
      expect(ctx.t.getSnapshot().phase).toBe("ended");
    });

    it("searches again straight from the held ended view", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx);
      room.push({ t: "meta", meta: meta({ phase: "ended" }) });
      room.serverClose(4404);
      ctx.t.findMatch(SELF);
      expect(ctx.t.getSnapshot().phase).toBe("matching");
      expect(ctx.last().url).toMatch(/\/api\/chat\/lobby$/);
    });

    it("goes idle on 4404 while active", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx);
      room.serverClose(4404);
      expect(ctx.t.getSnapshot()).toBe(IDLE_SNAPSHOT);
      expect(ctx.storage.data.has(MATCH_ID_KEY)).toBe(false);
    });

    it("goes idle and forgets the match on 4401", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx);
      room.serverClose(4401);
      expect(ctx.t.getSnapshot()).toBe(IDLE_SNAPSHOT);
      expect(ctx.storage.data.has(MATCH_ID_KEY)).toBe(false);
      vi.advanceTimersByTime(60_000);
      expect(FakeWebSocket.instances.at(-1)).toBe(room);
    });

    it("reloads once on a protocol version mismatch", () => {
      const ctx = setup();
      ctx.t.findMatch(SELF);
      ctx.last().serverClose(4426);
      expect(ctx.reload).toHaveBeenCalledTimes(1);
      ctx.t.findMatch(SELF);
      ctx.last().serverClose(4426);
      expect(ctx.reload).toHaveBeenCalledTimes(1);
      expect(ctx.t.getSnapshot()).toBe(IDLE_SNAPSHOT);
    });

    it("tells the user to refresh when the reload is declined", () => {
      const ctx = setup();
      ctx.reload.mockReturnValue(false);
      activeRoom(ctx).room.serverClose(4426);
      expect(ctx.onError).toHaveBeenCalledWith(
        expect.stringMatching(/refresh/),
      );
    });

    it("goes idle quietly when the lobby is switched off (4404)", () => {
      const ctx = setup();
      ctx.t.findMatch(SELF);
      ctx.last().open();
      ctx.last().serverClose(4404);
      expect(ctx.t.getSnapshot()).toBe(IDLE_SNAPSHOT);
      vi.advanceTimersByTime(60_000);
      expect(FakeWebSocket.instances).toHaveLength(1);
      expect(ctx.onError).not.toHaveBeenCalled();
    });

    it("keeps retrying past the give-up cap when refused with 4429", () => {
      const ctx = setup();
      ctx.t.findMatch(SELF);
      for (let i = 0; i < MAX_FAILED_CONNECTS + 2; i++) {
        // Accepted, then closed: unlike a refused upgrade, it opened.
        ctx.last().open();
        ctx.last().serverClose(4429);
        vi.advanceTimersByTime(5_000);
      }
      expect(FakeWebSocket.instances).toHaveLength(MAX_FAILED_CONNECTS + 3);
      expect(ctx.t.getSnapshot().phase).toBe("matching");
      expect(ctx.onError).not.toHaveBeenCalled();
    });

    it("goes idle without reconnecting on 4409", () => {
      const ctx = setup();
      ctx.t.findMatch(SELF);
      ctx.last().open();
      ctx.last().serverClose(4409);
      expect(ctx.t.getSnapshot()).toBe(IDLE_SNAPSHOT);
      vi.advanceTimersByTime(60_000);
      expect(FakeWebSocket.instances).toHaveLength(1);
      expect(ctx.onError).not.toHaveBeenCalled();
    });

    it("goes idle and explains a queue timeout on 4408", () => {
      const ctx = setup();
      ctx.t.findMatch(SELF);
      ctx.last().open();
      ctx.last().serverClose(4408);
      expect(ctx.t.getSnapshot()).toBe(IDLE_SNAPSHOT);
      expect(ctx.onError).toHaveBeenCalledWith(QUEUE_TIMEOUT_MESSAGE);
      vi.advanceTimersByTime(60_000);
      expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it("reconnects with backoff on any other code", () => {
      const ctx = setup();
      const { room } = activeRoom(ctx);
      const count = FakeWebSocket.instances.length;
      room.serverClose(1000);
      vi.advanceTimersByTime(249);
      expect(FakeWebSocket.instances).toHaveLength(count);
      vi.advanceTimersByTime(1);
      expect(FakeWebSocket.instances).toHaveLength(count + 1);
      expect(ctx.last().url).toBe(room.url);
    });
  });

  it("never puts the secret in any frame but join and auth", () => {
    const ctx = setup();
    const { room } = activeRoom(ctx, [msg("1", "partner", "hi")]);
    ctx.t.send("hello", { replyToId: "1" });
    ctx.t.react("1", "❤️");
    ctx.t.setTyping(true);
    ctx.t.setTyping(false);
    ctx.t.dealCard("card-1");
    ctx.t.submitRevealHandle("@me");
    room.serverClose(1006);
    vi.advanceTimersByTime(250);
    ctx.last().open();
    ctx.last().push({ t: "sync", meta: meta(), messages: [] });
    ctx.t.leave();
    const all = FakeWebSocket.instances.flatMap((s) => s.sent);
    const withSecret = all.filter((raw) =>
      raw.includes(credentials.sessionSecret),
    );
    expect(withSecret.length).toBeGreaterThan(0);
    for (const raw of withSecret) {
      expect(["join", "auth"]).toContain(JSON.parse(raw).t);
    }
    expect(all.length).toBeGreaterThan(withSecret.length + 5);
  });

  it("dispose() closes the sockets and stops emitting", () => {
    const ctx = setup();
    const { room } = activeRoom(ctx);
    const count = ctx.seen.length;
    ctx.t.dispose();
    expect(room.closedWith).toBe(1000);
    room.push({
      t: "msgs",
      messages: [msg("1", "partner", "late")],
    } satisfies RoomServerFrame);
    window.dispatchEvent(new Event("online"));
    vi.advanceTimersByTime(60_000);
    expect(ctx.seen).toHaveLength(count);
    expect(vi.getTimerCount()).toBe(0);
  });
});
