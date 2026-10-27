import { describe, expect, it } from "vitest";
import { DM_PREVIEW_MAX, MAX_DM_LEN } from "./constants";
import {
  buildReportSnapshot,
  type DmOpContext,
  type DmRow,
  nextReadSeq,
  previewOf,
  projectDmMessage,
  react,
  send,
  type ThreadSnapshot,
  threadSyncUrgency,
  unsend,
} from "./engine";
import { dmPair, parseThreadId, sideOf } from "./pair";

const NOW = 1_700_000_000_000;
const low: DmOpContext = { side: 0, now: NOW, canSend: true };
const high: DmOpContext = { side: 1, now: NOW, canSend: true };

function row(
  seq: number,
  author: 0 | 1,
  text: string | null = `m${seq}`,
): DmRow {
  return {
    seq,
    author,
    text,
    replyTo: null,
    reactionLow: null,
    reactionHigh: null,
    createdAt: NOW + seq,
  };
}

function snap(over: Partial<ThreadSnapshot> = {}): ThreadSnapshot {
  return {
    lastSeq: 1,
    lastAt: NOW,
    lastSender: 0,
    preview: "hi",
    readSeq: [1, 0],
    hiddenSeq: [0, 0],
    ...over,
  };
}

describe("dmPair", () => {
  it("gives both participants the same thread id", () => {
    expect(dmPair("bob", "amy")).toEqual(dmPair("amy", "bob"));
    expect(dmPair("bob", "amy").threadId).toBe("amy:bob");
  });

  it("maps each participant to their side and rejects outsiders", () => {
    const pair = dmPair("bob", "amy");
    expect(sideOf(pair, "amy")).toBe(0);
    expect(sideOf(pair, "bob")).toBe(1);
    expect(sideOf(pair, "eve")).toBeNull();
  });

  it("rejects thread ids that aren't a sorted pair", () => {
    expect(parseThreadId("bob:amy")).toBeNull();
    expect(parseThreadId("amy:amy")).toBeNull();
    expect(parseThreadId("amy:bob:eve")).toBeNull();
    expect(parseThreadId("amy:bob")?.highId).toBe("bob");
  });
});

describe("send", () => {
  it("stores trimmed text with the sender's side and reply target", () => {
    const res = send(high, {
      text: "  hey there \r\n",
      wantsReply: true,
      replyTarget: row(4, 0),
    });
    expect(res).toEqual({
      ok: true,
      insert: expect.objectContaining({
        author: 1,
        text: "hey there",
        replyTo: 4,
      }),
    });
  });

  it("rejects blank and over-long text", () => {
    expect(
      send(low, { text: "   ", wantsReply: false, replyTarget: null }),
    ).toEqual({
      ok: false,
      code: "invalid",
    });
    const long = "a".repeat(MAX_DM_LEN + 1);
    expect(
      send(low, { text: long, wantsReply: false, replyTarget: null }).ok,
    ).toBe(false);
  });

  it("refuses to send once the pair can no longer message", () => {
    const res = send(
      { ...low, canSend: false },
      { text: "hi", wantsReply: false, replyTarget: null },
    );
    expect(res).toEqual({ ok: false, code: "closed" });
  });

  it("fails a reply to a message that doesn't exist", () => {
    expect(
      send(low, { text: "hi", wantsReply: true, replyTarget: null }),
    ).toEqual({
      ok: false,
      code: "not_found",
    });
  });
});

describe("react", () => {
  it("sets only the reacting side's field", () => {
    const res = react(high, row(2, 0), "🔥");
    expect(res.ok && res.update).toMatchObject({
      reactionHigh: "🔥",
      reactionLow: null,
    });
  });

  it("toggles off when the same emoji is sent again", () => {
    const res = react(low, { ...row(2, 1), reactionLow: "😂" }, "😂");
    expect(res.ok && res.update?.reactionLow).toBeNull();
  });

  it("writes nothing when clearing a reaction that isn't set", () => {
    expect(react(low, row(2, 1), "")).toEqual({ ok: true });
  });

  it("rejects emoji outside the fixed set and unsent targets", () => {
    expect(react(low, row(2, 1), "🍕")).toEqual({ ok: false, code: "invalid" });
    expect(react(low, row(2, 1, null), "🔥")).toEqual({
      ok: false,
      code: "not_found",
    });
  });
});

describe("unsend", () => {
  it("clears the text and both reactions of your own message", () => {
    const res = unsend(low, { ...row(3, 0), reactionHigh: "❤️" });
    expect(res.ok && res.update).toMatchObject({
      text: null,
      reactionHigh: null,
    });
  });

  it("refuses to unsend the other side's message", () => {
    expect(unsend(low, row(3, 1))).toEqual({ ok: false, code: "invalid" });
  });

  it("still works after the pair can no longer message", () => {
    const res = unsend({ ...low, canSend: false }, row(3, 0));
    expect(res.ok && res.update?.text).toBeNull();
  });
});

describe("nextReadSeq", () => {
  it("moves forward, clamped to the newest message", () => {
    expect(nextReadSeq(2, 9, 5)).toBe(5);
  });

  it("never moves backwards or stays put with a write", () => {
    expect(nextReadSeq(5, 3, 9)).toBeNull();
    expect(nextReadSeq(5, 5, 9)).toBeNull();
  });
});

describe("projectDmMessage", () => {
  it("shows each viewer their own reaction as mine", () => {
    const r = { ...row(1, 0), reactionLow: "❤️", reactionHigh: "😂" };
    expect(projectDmMessage(r, 0, null)).toMatchObject({
      mine: true,
      myReaction: "❤️",
      theirReaction: "😂",
    });
    expect(projectDmMessage(r, 1, null)).toMatchObject({
      mine: false,
      myReaction: "😂",
      theirReaction: "❤️",
    });
  });

  it("echoes the client id only to the author", () => {
    expect(projectDmMessage(row(1, 0), 0, null, "c1").clientId).toBe("c1");
    expect(projectDmMessage(row(1, 0), 1, null, "c1").clientId).toBeUndefined();
  });
});

describe("buildReportSnapshot", () => {
  it("includes the context before the reported message, marked by author", () => {
    const res = buildReportSnapshot(0, row(3, 1), [
      row(1, 0),
      row(2, 1),
      row(4, 0),
    ]);
    expect(res.ok && res.entries.map((e) => [e.seq, e.fromReporter])).toEqual([
      [1, true],
      [2, false],
      [3, false],
    ]);
  });

  it("refuses to report your own or an unsent message", () => {
    expect(buildReportSnapshot(0, row(3, 0), []).ok).toBe(false);
    expect(buildReportSnapshot(0, row(3, 1, null), []).ok).toBe(false);
  });
});

describe("threadSyncUrgency", () => {
  it("writes at once for a new thread", () => {
    expect(threadSyncUrgency(null, snap())).toBe("now");
  });

  it("writes at once when a message makes the thread unread", () => {
    const synced = snap({ lastSeq: 1, lastSender: 0, readSeq: [1, 1] });
    const next = snap({ lastSeq: 2, lastSender: 0, readSeq: [2, 1] });
    expect(threadSyncUrgency(synced, next)).toBe("now");
  });

  it("debounces further messages while the thread is already unread", () => {
    const synced = snap({ lastSeq: 2, lastSender: 0, readSeq: [2, 1] });
    const next = snap({
      lastSeq: 3,
      lastSender: 0,
      readSeq: [3, 1],
      preview: "x",
    });
    expect(threadSyncUrgency(synced, next)).toBe("later");
  });

  it("writes at once when the recipient reads, so their badge clears", () => {
    const synced = snap({ lastSeq: 3, lastSender: 0, readSeq: [3, 1] });
    const next = snap({ lastSeq: 3, lastSender: 0, readSeq: [3, 3] });
    expect(threadSyncUrgency(synced, next)).toBe("now");
  });

  it("writes at once when a side hides the chat", () => {
    const synced = snap();
    expect(threadSyncUrgency(synced, snap({ hiddenSeq: [1, 0] }))).toBe("now");
  });

  it("writes nothing when nothing changed", () => {
    expect(threadSyncUrgency(snap(), snap())).toBe("none");
  });
});

describe("previewOf", () => {
  it("truncates to the preview length", () => {
    expect(previewOf("a".repeat(500))).toHaveLength(DM_PREVIEW_MAX);
    expect(previewOf(null)).toBeNull();
  });
});
