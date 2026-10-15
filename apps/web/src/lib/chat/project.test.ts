import { describe, expect, it } from "vitest";
import { REPLY_PREVIEW_LEN } from "./constants";
import { GAME_DECKS } from "./decks";
import {
  endMatch,
  initialMatch,
  type MatchState,
  type MessageRow,
  type Side,
} from "./engine";
import {
  GAME_PREVIEW,
  projectMessage,
  projectMeta,
  WHISPER_PREVIEW,
} from "./project";

const ANA = { alias: "ana", avatarSeed: "seed-a", interests: ["music", "art"] };
const BEN = { alias: "ben", avatarSeed: "seed-b", interests: ["music"] };
const CARD = GAME_DECKS["this-or-that"][0].id;

const base = (patch: Partial<MatchState> = {}): MatchState => ({
  ...initialMatch(ANA, BEN, 0),
  seenA: true,
  seenB: true,
  ...patch,
});

const meta = (match: MatchState, viewer: Side, partnerOnline = true) =>
  projectMeta(match, viewer, partnerOnline, "room-1");

const row = (patch: Partial<MessageRow> = {}): MessageRow => ({
  seq: 1,
  author: "a",
  text: "hello",
  reactionA: null,
  reactionB: null,
  replyTo: null,
  kind: null,
  whisperViewedAt: null,
  burned: false,
  game: null,
  effect: null,
  createdAt: 1234,
  ...patch,
});

const whisper = (patch: Partial<MessageRow> = {}) =>
  row({ kind: "whisper", text: "the secret", ...patch });

describe("projectMeta", () => {
  it("is viewer-relative for identities and stay-connected", () => {
    const m = base({ stayA: true });
    const a = meta(m, "a");
    expect(a.matchId).toBe("room-1");
    expect(a.self.alias).toBe("ana");
    expect(a.partner).toMatchObject({
      alias: "ben",
      avatarSeed: "seed-b",
      sharedInterests: ["music"],
    });
    expect(a.stayConnected).toEqual({ self: true, partner: false });
    const b = meta(m, "b");
    expect(b.self.alias).toBe("ben");
    expect(b.partner?.alias).toBe("ana");
    expect(b.stayConnected).toEqual({ self: false, partner: true });
  });

  it("partner status: online, away once seen and gone, connecting reads online, left when ended", () => {
    expect(meta(base(), "a", true).partner?.status).toBe("online");
    expect(meta(base(), "a", false).partner?.status).toBe("away");
    expect(meta(base({ seenB: false }), "a", false).partner?.status).toBe(
      "online",
    );
    const ended = endMatch(base(), 10, "b");
    expect(meta(ended, "a", true).partner?.status).toBe("left");
  });

  it("an active match has phase active and no endedReason", () => {
    const a = meta(base(), "a");
    expect(a.phase).toBe("active");
    expect(a).not.toHaveProperty("endedReason");
  });

  it("a voluntary leave reads self-ended for the leaver, partner-left for the survivor", () => {
    const ended = endMatch(base(), 10, "a");
    expect(meta(ended, "a")).toMatchObject({
      phase: "ended",
      endedReason: "self-ended",
    });
    expect(meta(ended, "b").endedReason).toBe("partner-left");
  });

  it("an absence end reads partner-left on both sides", () => {
    const ended = endMatch(base(), 10, null);
    expect(meta(ended, "a").endedReason).toBe("partner-left");
    expect(meta(ended, "b").endedReason).toBe("partner-left");
  });

  describe("game round", () => {
    const dealt = (patch: Partial<NonNullable<MatchState["game"]>> = {}) =>
      base({
        game: {
          cardId: CARD,
          dealtBy: "a",
          mode: "match",
          answerA: null,
          answerB: null,
          ...patch,
        },
      });

    it("shows the round to both players, viewer-relative", () => {
      expect(meta(dealt(), "a").game).toEqual({
        cardId: CARD,
        dealtBy: "self",
        mode: "match",
        selfPick: null,
        partnerAnswered: false,
      });
      expect(meta(dealt({ mode: "guess" }), "b").game).toMatchObject({
        dealtBy: "partner",
        mode: "guess",
      });
    });

    it("withholds the partner's pick until both have answered", () => {
      const m = dealt({ answerA: "A" });
      const a = meta(m, "a").game;
      expect(a).toMatchObject({ selfPick: "A", partnerAnswered: false });
      expect(a).not.toHaveProperty("partnerPick");
      // The other side learns THAT a answered, never WHAT.
      const b = meta(m, "b").game;
      expect(b).toMatchObject({ selfPick: null, partnerAnswered: true });
      expect(b).not.toHaveProperty("partnerPick");
      expect(JSON.stringify(meta(m, "b"))).not.toContain('"A"');
    });

    it("reveals both picks once both answered", () => {
      const m = dealt({ answerA: "A", answerB: "B" });
      expect(meta(m, "a").game).toMatchObject({
        selfPick: "A",
        partnerPick: "B",
      });
      expect(meta(m, "b").game).toMatchObject({
        selfPick: "B",
        partnerPick: "A",
      });
    });
  });

  describe("reveal", () => {
    it("is locked until both sides tapped stay-connected", () => {
      expect(meta(base({ stayA: true }), "a").reveal.unlocked).toBe(false);
      expect(
        meta(base({ stayA: true, stayB: true }), "a").reveal.unlocked,
      ).toBe(true);
    });

    it("one submission shows THAT, never WHAT", () => {
      const m = base({ stayA: true, stayB: true, revealA: "@me" });
      expect(meta(m, "a").reveal).toMatchObject({
        self: { submitted: true, handle: "@me" },
        partner: { submitted: false },
      });
      const b = meta(m, "b");
      expect(b.reveal.partner).toEqual({ submitted: true });
      expect(b.reveal.self).toEqual({ submitted: false });
      expect(JSON.stringify(b)).not.toContain("@me");
    });

    it("both submissions reveal both handles, viewer-relative", () => {
      const m = base({
        stayA: true,
        stayB: true,
        revealA: "@aa",
        revealB: "@bb",
      });
      expect(meta(m, "a").reveal).toMatchObject({
        self: { handle: "@aa" },
        partner: { handle: "@bb" },
      });
      expect(meta(m, "b").reveal).toMatchObject({
        self: { handle: "@bb" },
        partner: { handle: "@aa" },
      });
    });

    it("a mutually revealed handle survives into the ended view", () => {
      const m = endMatch(
        base({ stayA: true, stayB: true, revealA: "@aa", revealB: "@bb" }),
        5,
        "b",
      );
      const a = meta(m, "a");
      expect(a.phase).toBe("ended");
      expect(a.reveal.partner.handle).toBe("@bb");
    });
  });
});

describe("projectMessage", () => {
  it("uses the seq as id and resolves the author per viewer", () => {
    const r = row({ seq: 42 });
    expect(projectMessage(r, "a", null)).toMatchObject({
      id: "42",
      author: "self",
      text: "hello",
      ts: 1234,
    });
    expect(projectMessage(r, "b", null).author).toBe("partner");
  });

  it("attributes reactions per viewer in A-then-B order", () => {
    const r = row({ reactionA: "🔥", reactionB: "❤️" });
    expect(projectMessage(r, "a", null).reactions).toEqual([
      { emoji: "🔥", by: "self" },
      { emoji: "❤️", by: "partner" },
    ]);
    expect(projectMessage(r, "b", null).reactions).toEqual([
      { emoji: "🔥", by: "partner" },
      { emoji: "❤️", by: "self" },
    ]);
  });

  it("passes an effect through", () => {
    expect(projectMessage(row({ effect: "confetti" }), "b", null).effect).toBe(
      "confetti",
    );
  });

  it("never leaks room internals: only the wire fields leave", () => {
    const wire = new Set([
      "id",
      "author",
      "text",
      "ts",
      "reactions",
      "replyTo",
      "whisper",
      "effect",
      "gameResult",
    ]);
    const rows = [
      row({ reactionA: "🔥", effect: "hearts" }),
      whisper({ seq: 2, whisperViewedAt: 9 }),
      row({
        seq: 3,
        kind: "game",
        text: "",
        game: {
          cardId: CARD,
          pickA: "A",
          pickB: "B",
          mode: "match",
          dealtBy: "b",
        },
      }),
      row({ seq: 4, replyTo: 1 }),
    ];
    for (const viewer of ["a", "b"] as const) {
      for (const r of rows) {
        const msg = projectMessage(r, viewer, r.replyTo ? rows[0] : null);
        for (const key of Object.keys(msg)) expect(wire).toContain(key);
        const sides = [
          msg.author,
          ...msg.reactions.map((x) => x.by),
          msg.replyTo?.author,
          msg.gameResult?.dealtBy,
        ].filter(Boolean);
        for (const s of sides) expect(["self", "partner"]).toContain(s);
      }
    }
  });

  describe("whispers", () => {
    it("hides the plaintext from the recipient until revealed; the author keeps it", () => {
      expect(projectMessage(whisper(), "b", null)).toMatchObject({
        text: "",
        whisper: { state: "hidden" },
      });
      expect(projectMessage(whisper(), "a", null)).toMatchObject({
        text: "the secret",
        whisper: { state: "hidden" },
      });
    });

    it("a revealed whisper shows its text to both with the viewedAt anchor", () => {
      const r = whisper({ whisperViewedAt: 5000 });
      for (const viewer of ["a", "b"] as const) {
        expect(projectMessage(r, viewer, null)).toMatchObject({
          text: "the secret",
          whisper: { state: "revealed", viewedAt: 5000 },
        });
      }
    });

    it("a burned whisper is empty for both sides, even if the row still had text", () => {
      const r = whisper({ whisperViewedAt: 5000, burned: true });
      for (const viewer of ["a", "b"] as const) {
        const msg = projectMessage(r, viewer, null);
        expect(msg.text).toBe("");
        expect(msg.whisper).toEqual({ state: "burned" });
      }
    });
  });

  describe("replies", () => {
    const reply = (target: MessageRow, viewer: Side) =>
      projectMessage(
        row({ seq: 9, author: "b", replyTo: target.seq }),
        viewer,
        target,
      ).replyTo;

    it("resolves the quoted target to each viewer's perspective", () => {
      const target = row({ seq: 3, text: "original" });
      expect(reply(target, "a")).toEqual({
        id: "3",
        author: "self",
        text: "original",
      });
      expect(reply(target, "b")).toEqual({
        id: "3",
        author: "partner",
        text: "original",
      });
    });

    it("truncates the preview to REPLY_PREVIEW_LEN", () => {
      const target = row({ text: "x".repeat(REPLY_PREVIEW_LEN + 50) });
      expect(reply(target, "a")?.text).toBe("x".repeat(REPLY_PREVIEW_LEN));
    });

    it("a quoted whisper shows a placeholder for both, never the text", () => {
      const target = whisper({ whisperViewedAt: 5000 });
      expect(reply(target, "a")?.text).toBe(WHISPER_PREVIEW);
      expect(reply(target, "b")?.text).toBe(WHISPER_PREVIEW);
    });

    it("a quoted game row shows a placeholder", () => {
      const target = row({ kind: "game", text: "" });
      expect(reply(target, "b")?.text).toBe(GAME_PREVIEW);
    });

    it("a reference that didn't resolve is dropped, the message kept", () => {
      const msg = projectMessage(
        row({ seq: 9, replyTo: 3, text: "cross-room reply" }),
        "a",
        null,
      );
      expect(msg.text).toBe("cross-room reply");
      expect(msg).not.toHaveProperty("replyTo");
    });
  });

  describe("game rows", () => {
    const gameRow = (mode: "match" | "guess") =>
      row({
        author: "b",
        kind: "game",
        text: "",
        game: { cardId: CARD, pickA: "A", pickB: "B", mode, dealtBy: "a" },
      });

    it("records a completed match round viewer-relative, without a mode", () => {
      expect(projectMessage(gameRow("match"), "a", null)).toMatchObject({
        text: "",
        gameResult: {
          cardId: CARD,
          selfPick: "A",
          partnerPick: "B",
          dealtBy: "self",
        },
      });
      expect(
        projectMessage(gameRow("match"), "a", null).gameResult,
      ).not.toHaveProperty("mode");
      expect(projectMessage(gameRow("match"), "b", null).gameResult).toEqual({
        cardId: CARD,
        selfPick: "B",
        partnerPick: "A",
        dealtBy: "partner",
      });
    });

    it("a guess round carries its mode", () => {
      expect(projectMessage(gameRow("guess"), "b", null).gameResult?.mode).toBe(
        "guess",
      );
    });
  });
});
