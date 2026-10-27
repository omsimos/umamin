import { describe, expect, it } from "vitest";
import {
  type DmState,
  dmReducer,
  initialDmState,
  lastPeerSeq,
  localId,
  seenMessageId,
} from "./client-state";
import type { DmMessage, DmMeta } from "./types";

const META: DmMeta = { peerOnline: true, peerReadSeq: 0, canSend: true };

function msg(
  id: number,
  mine: boolean,
  over: Partial<DmMessage> = {},
): DmMessage {
  return {
    id: String(id),
    mine,
    text: `m${id}`,
    replyTo: null,
    myReaction: null,
    theirReaction: null,
    createdAt: id,
    ...over,
  };
}

function synced(messages: DmMessage[]): DmState {
  return dmReducer(initialDmState, {
    type: "sync",
    messages,
    meta: META,
    hasMore: false,
  });
}

describe("dmReducer", () => {
  it("swaps an optimistic send for the server copy that echoes its client id", () => {
    let s = synced([msg(1, false)]);
    s = dmReducer(s, {
      type: "send",
      clientId: "c1",
      text: "hi",
      replyTo: null,
      at: 5,
    });
    expect(s.messages.map((m) => m.id)).toEqual(["1", localId("c1")]);
    s = dmReducer(s, {
      type: "msgs",
      messages: [msg(2, true, { clientId: "c1" })],
    });
    expect(s.messages.map((m) => [m.id, m.delivery])).toEqual([
      ["1", undefined],
      ["2", undefined],
    ]);
  });

  it("keeps an unacked send across a reconnect sync", () => {
    let s = synced([msg(1, false)]);
    s = dmReducer(s, {
      type: "send",
      clientId: "c1",
      text: "hi",
      replyTo: null,
      at: 5,
    });
    s = dmReducer(s, {
      type: "sync",
      messages: [msg(1, false)],
      meta: META,
      hasMore: false,
    });
    expect(s.messages.map((m) => m.id)).toEqual(["1", localId("c1")]);
  });

  it("drops the optimistic copy when the reconnect sync already has it", () => {
    let s = synced([]);
    s = dmReducer(s, {
      type: "send",
      clientId: "c1",
      text: "hi",
      replyTo: null,
      at: 5,
    });
    s = dmReducer(s, {
      type: "sync",
      messages: [msg(7, true, { clientId: "c1" })],
      meta: META,
      hasMore: false,
    });
    expect(s.messages.map((m) => m.id)).toEqual(["7"]);
  });

  it("applies edits in place and prepends history in order", () => {
    let s = synced([msg(5, false), msg(6, true)]);
    s = dmReducer(s, {
      type: "msgs",
      messages: [msg(5, false, { myReaction: "🔥" })],
    });
    expect(s.messages[0]?.myReaction).toBe("🔥");
    s = dmReducer(s, {
      type: "history",
      messages: [msg(3, true), msg(4, false)],
      hasMore: false,
    });
    expect(s.messages.map((m) => m.id)).toEqual(["3", "4", "5", "6"]);
  });

  it("marks a failed send and back to sending on retry", () => {
    let s = synced([]);
    s = dmReducer(s, {
      type: "send",
      clientId: "c1",
      text: "hi",
      replyTo: null,
      at: 5,
    });
    s = dmReducer(s, { type: "failed", clientId: "c1" });
    expect(s.messages[0]?.delivery).toBe("failed");
    s = dmReducer(s, { type: "retry", clientId: "c1" });
    expect(s.messages[0]?.delivery).toBe("sending");
  });

  it("clears the typing indicator when the peer's message lands or the socket drops", () => {
    let s = dmReducer(synced([]), { type: "typing", on: true, at: 10 });
    expect(s.peerTypingAt).toBe(10);
    s = dmReducer(s, { type: "msgs", messages: [msg(1, false)] });
    expect(s.peerTypingAt).toBeNull();
    s = dmReducer(s, { type: "typing", on: true, at: 11 });
    s = dmReducer(s, { type: "status", status: "reconnecting" });
    expect(s.peerTypingAt).toBeNull();
  });
});

describe("read helpers", () => {
  it("finds the newest peer message, ignoring mine and pending", () => {
    const s = dmReducer(
      synced([msg(1, false), msg(2, true), msg(3, false), msg(4, true)]),
      {
        type: "send",
        clientId: "c",
        text: "x",
        replyTo: null,
        at: 9,
      },
    );
    expect(lastPeerSeq(s.messages)).toBe(3);
  });

  it("places the seen marker on my newest message the peer has read", () => {
    const s = synced([msg(1, true), msg(2, false), msg(3, true), msg(4, true)]);
    expect(seenMessageId(s.messages, 3)).toBe("3");
    expect(seenMessageId(s.messages, 0)).toBeNull();
  });
});
