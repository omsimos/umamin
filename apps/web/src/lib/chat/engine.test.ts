import { describe, expect, it } from "vitest";
import {
  ALLOWED_REACTIONS,
  MAX_MESSAGE_LEN,
  MAX_REVEAL_HANDLE_LEN,
  MAX_ROOM_MESSAGES,
  REACTION_MIN_LEVEL,
  WHISPER_BURN_MS,
} from "./constants";
import { GAME_DECKS } from "./decks";
import {
  answerCard,
  bothSeen,
  burnWhisper,
  countVibe,
  dealCard,
  dismissGame,
  endMatch,
  initialMatch,
  leave,
  type MatchState,
  type MessageRow,
  markSeen,
  matchVibe,
  type OpContext,
  type OpResult,
  react,
  type Side,
  send,
  stayConnected,
  submitReveal,
  viewWhisper,
  withdrawReveal,
} from "./engine";
import { SideLimiter } from "./limits";
import type { GameMode, GamePick } from "./types";

const ANA = { alias: "ana", avatarSeed: "seed-a", interests: ["music", "art"] };
const BEN = {
  alias: "ben",
  avatarSeed: "seed-b",
  interests: ["tech", "music"],
};

const CARD = GAME_DECKS["this-or-that"][0].id;
const OTHER_CARD = GAME_DECKS["would-you-rather"][0].id;

/** In-memory stand-in for the ChatRoom adapter: applies op results the way the
 *  room does (charge, then match/insert/update) with incrementing seqs. */
class Room {
  match: MatchState;
  rows: MessageRow[] = [];
  now = 1_700_000_000_000;
  private seq = 0;
  private limiter: SideLimiter | null;

  constructor(opts: { limits?: boolean } = {}) {
    this.match = initialMatch(ANA, BEN, this.now);
    this.limiter = opts.limits ? new SideLimiter() : null;
  }

  get vibe() {
    return matchVibe(this.match, countVibe(this.rows));
  }

  ctx(side: Side): OpContext {
    return {
      match: this.match,
      side,
      now: this.now,
      level: this.vibe.level,
    };
  }

  row(seq: number): MessageRow | null {
    return this.rows.find((r) => r.seq === seq) ?? null;
  }

  last(): MessageRow {
    const row = this.rows.at(-1);
    if (!row) throw new Error("no rows");
    return row;
  }

  apply(side: Side, res: OpResult): OpResult {
    if (!res.ok) return res;
    if (
      res.charge &&
      this.limiter &&
      !this.limiter.take(side, res.charge, this.now)
    ) {
      return { ok: false, code: "rate_limited" };
    }
    if (res.match) this.match = res.match;
    if (res.insert) {
      this.seq += 1;
      this.rows.push({ ...res.insert, seq: this.seq });
    }
    const update = res.update;
    if (update) {
      this.rows = this.rows.map((r) => (r.seq === update.seq ? update : r));
    }
    return res;
  }

  send(
    side: Side,
    text: string,
    opts: { whisper?: boolean; effect?: string; replyTo?: number } = {},
  ) {
    return this.apply(
      side,
      send(this.ctx(side), {
        text,
        whisper: opts.whisper,
        effect: opts.effect,
        replyTarget: opts.replyTo === undefined ? null : this.row(opts.replyTo),
        messageCount: this.rows.length,
      }),
    );
  }

  react(side: Side, seq: number, emoji: string) {
    return this.apply(side, react(this.ctx(side), this.row(seq), emoji));
  }

  viewWhisper(side: Side, seq: number) {
    return this.apply(side, viewWhisper(this.ctx(side), this.row(seq)));
  }

  burn(seq: number) {
    const burned = burnWhisper(this.row(seq));
    if (burned) {
      this.rows = this.rows.map((r) => (r.seq === seq ? burned : r));
    }
    return burned;
  }

  deal(side: Side, cardId: string, mode?: GameMode) {
    return this.apply(side, dealCard(this.ctx(side), cardId, mode));
  }

  answer(side: Side, cardId: string, pick: GamePick) {
    return this.apply(side, answerCard(this.ctx(side), cardId, pick));
  }

  dismiss(side: Side) {
    return this.apply(side, dismissGame(this.ctx(side)));
  }

  stay(side: Side) {
    return this.apply(side, stayConnected(this.ctx(side)));
  }

  submitReveal(side: Side, handle: string) {
    return this.apply(side, submitReveal(this.ctx(side), handle));
  }

  withdrawReveal(side: Side) {
    return this.apply(side, withdrawReveal(this.ctx(side)));
  }

  leave(side: Side) {
    return this.apply(side, leave(this.ctx(side)));
  }

  /** Trades message pairs until the shared vibe reaches `level`. */
  warmUp(level: number) {
    while (this.vibe.level < level) {
      if (this.rows.length > 200) throw new Error(`level ${level} unreachable`);
      this.send("a", "hey");
      this.send("b", "hi");
    }
  }

  playRound(cardId: string, pickA: GamePick, pickB: GamePick, mode?: GameMode) {
    this.deal("a", cardId, mode);
    this.answer("a", cardId, pickA);
    this.answer("b", cardId, pickB);
  }
}

const matched = () => new Room();

function mutual() {
  const room = new Room();
  room.stay("a");
  room.stay("b");
  return room;
}

describe("initialMatch / markSeen", () => {
  it("starts active with only the interests both sides picked as shared", () => {
    const m = initialMatch(ANA, BEN, 5);
    expect(m.status).toBe("active");
    expect(m.sharedInterests).toEqual(["music"]);
    expect(m.createdAt).toBe(5);
  });

  it("markSeen latches each side once and returns null on a reconnect", () => {
    const m0 = initialMatch(ANA, BEN, 0);
    const m1 = markSeen(m0, "a");
    expect(m1?.seenA).toBe(true);
    expect(m1 && bothSeen(m1)).toBe(false);
    expect(m1 && markSeen(m1, "a")).toBeNull();
    const m2 = m1 && markSeen(m1, "b");
    expect(m2 && bothSeen(m2)).toBe(true);
  });
});

describe("send", () => {
  it("appends a trimmed message for the sender and charges sendMessage", () => {
    const room = matched();
    const res = room.send("a", "  hello  ");
    expect(res).toMatchObject({ ok: true, charge: "sendMessage" });
    expect(room.last()).toMatchObject({
      seq: 1,
      author: "a",
      text: "hello",
      kind: null,
      createdAt: room.now,
    });
  });

  it("rejects a message longer than MAX_MESSAGE_LEN and stores nothing", () => {
    const room = matched();
    expect(room.send("a", "x".repeat(MAX_MESSAGE_LEN + 1))).toEqual({
      ok: false,
      code: "invalid",
    });
    expect(room.rows).toHaveLength(0);
  });

  it("measures the cap after trimming, inclusive at the boundary", () => {
    const room = matched();
    room.send("a", `  ${"x".repeat(MAX_MESSAGE_LEN)}  `);
    expect(room.last().text).toBe("x".repeat(MAX_MESSAGE_LEN));
  });

  it("ignores empty and whitespace-only text without charging", () => {
    const room = matched();
    expect(room.send("a", "   ")).toEqual({ ok: true });
    expect(room.send("a", "")).toEqual({ ok: true });
    expect(room.rows).toHaveLength(0);
  });

  it("rejects an unknown effect and stores nothing", () => {
    const room = matched();
    expect(room.send("a", "hi", { effect: "fireworks" })).toEqual({
      ok: false,
      code: "invalid",
    });
    expect(room.rows).toHaveLength(0);
  });

  it("stores an allowed effect", () => {
    const room = matched();
    room.send("a", "hi", { effect: "confetti" });
    expect(room.last().effect).toBe("confetti");
  });

  it("drops the effect when the message is a whisper", () => {
    const room = matched();
    room.send("a", "hi", { whisper: true, effect: "confetti" });
    expect(room.last()).toMatchObject({ kind: "whisper", effect: null });
  });

  it("rejects a locked effect even on a whisper", () => {
    const room = matched();
    expect(
      room.send("a", "psst", { whisper: true, effect: "sparkles" }),
    ).toEqual({ ok: false, code: "locked" });
  });

  it("rejects a locked effect below its level and allows it once reached", () => {
    const room = matched();
    expect(room.send("a", "shiny", { effect: "sparkles" })).toEqual({
      ok: false,
      code: "locked",
    });
    room.warmUp(3);
    room.send("a", "shiny", { effect: "sparkles" });
    expect(room.last().effect).toBe("sparkles");
  });

  it("refuses with cap once the room holds MAX_ROOM_MESSAGES", () => {
    const room = matched();
    const input = { text: "one more", replyTarget: null };
    expect(
      send(room.ctx("a"), { ...input, messageCount: MAX_ROOM_MESSAGES }),
    ).toEqual({ ok: false, code: "cap" });
    expect(
      send(room.ctx("a"), { ...input, messageCount: MAX_ROOM_MESSAGES - 1 }).ok,
    ).toBe(true);
  });

  it("records a resolved reply target by seq", () => {
    const room = matched();
    room.send("a", "original");
    room.send("b", "a reply", { replyTo: 1 });
    expect(room.last().replyTo).toBe(1);
  });

  it("drops an unresolved reply reference but keeps the message", () => {
    const room = matched();
    room.send("b", "reply to nothing", { replyTo: 99 });
    expect(room.last()).toMatchObject({
      text: "reply to nothing",
      replyTo: null,
    });
  });
});

describe("react", () => {
  it("keeps one reaction per side: a new emoji replaces the previous", () => {
    const room = matched();
    room.send("a", "hi");
    const base = ALLOWED_REACTIONS.filter(
      (e) => (REACTION_MIN_LEVEL[e] ?? 1) === 1,
    );
    for (const emoji of base) room.react("a", 1, emoji);
    expect(room.row(1)).toMatchObject({
      reactionA: base.at(-1),
      reactionB: null,
    });
  });

  it("repeating the current emoji toggles it off and charges react", () => {
    const room = matched();
    room.send("a", "hi");
    expect(room.react("b", 1, "❤️")).toMatchObject({ charge: "react" });
    expect(room.row(1)?.reactionB).toBe("❤️");
    room.react("b", 1, "❤️");
    expect(room.row(1)?.reactionB).toBeNull();
  });

  it("allows reacting to your own message", () => {
    const room = matched();
    room.send("a", "hi");
    room.react("a", 1, "🔥");
    expect(room.row(1)?.reactionA).toBe("🔥");
  });

  it("stores both sides when both react with the same emoji", () => {
    const room = matched();
    room.send("a", "hi");
    room.react("a", 1, "❤️");
    room.react("b", 1, "❤️");
    expect(room.row(1)).toMatchObject({ reactionA: "❤️", reactionB: "❤️" });
  });

  it("rejects an unsupported emoji", () => {
    const room = matched();
    room.send("a", "hi");
    expect(room.react("b", 1, "not-an-emoji")).toEqual({
      ok: false,
      code: "invalid",
    });
    expect(room.row(1)?.reactionB).toBeNull();
  });

  it("no-ops on a message that didn't resolve in this room", () => {
    const room = matched();
    expect(room.react("b", 42, "❤️")).toEqual({ ok: true });
  });

  it("rejects a locked reaction below its level and allows it once reached", () => {
    const room = matched();
    room.send("a", "hello");
    expect(room.react("b", 1, "🫶")).toEqual({ ok: false, code: "locked" });
    room.warmUp(REACTION_MIN_LEVEL["🫶"]);
    room.react("b", 1, "🫶");
    expect(room.row(1)?.reactionB).toBe("🫶");
  });

  it("clearing a gated reaction is allowed below its level", () => {
    const room = matched();
    room.send("a", "hello");
    const msg = { ...room.last(), reactionB: "🥹" };
    const res = react({ ...room.ctx("b"), level: 1 }, msg, "🥹");
    expect(res.ok && res.update?.reactionB).toBeNull();
  });
});

describe("whispers", () => {
  it("the recipient's view stamps viewedAt and schedules the burn", () => {
    const room = matched();
    room.send("a", "the secret", { whisper: true });
    const res = room.viewWhisper("b", 1);
    expect(res).toMatchObject({ ok: true, burnAt: room.now + WHISPER_BURN_MS });
    expect(room.row(1)?.whisperViewedAt).toBe(room.now);
  });

  it("the author cannot trigger the reveal", () => {
    const room = matched();
    room.send("a", "the secret", { whisper: true });
    expect(room.viewWhisper("a", 1)).toEqual({ ok: true });
    expect(room.row(1)?.whisperViewedAt).toBeNull();
  });

  it("is idempotent: a second view keeps the original viewedAt", () => {
    const room = matched();
    room.send("a", "the secret", { whisper: true });
    room.viewWhisper("b", 1);
    const first = room.row(1)?.whisperViewedAt;
    room.now += 3_000;
    expect(room.viewWhisper("b", 1)).toEqual({ ok: true });
    expect(room.row(1)?.whisperViewedAt).toBe(first);
  });

  it("no-ops on a plain message or a missing row", () => {
    const room = matched();
    room.send("a", "plain");
    expect(room.viewWhisper("b", 1)).toEqual({ ok: true });
    expect(room.viewWhisper("b", 7)).toEqual({ ok: true });
    expect(room.row(1)?.whisperViewedAt).toBeNull();
  });

  it("burnWhisper redacts the stored text and is a one-shot", () => {
    const room = matched();
    room.send("a", "the secret", { whisper: true });
    room.viewWhisper("b", 1);
    room.burn(1);
    expect(room.row(1)).toMatchObject({ text: "", burned: true });
    expect(room.burn(1)).toBeNull();
  });

  it("burnWhisper ignores a missing row and non-whispers", () => {
    const room = matched();
    room.send("a", "plain");
    expect(burnWhisper(null)).toBeNull();
    expect(room.burn(1)).toBeNull();
    expect(room.row(1)?.text).toBe("plain");
  });

  it("a burned whisper can no longer be viewed", () => {
    const room = matched();
    room.send("a", "the secret", { whisper: true });
    room.burn(1);
    expect(room.viewWhisper("b", 1)).toEqual({ ok: true });
    expect(room.row(1)?.whisperViewedAt).toBeNull();
  });
});

describe("stay connected", () => {
  it("latches one way; a repeat tap writes nothing", () => {
    const room = matched();
    expect(room.stay("a")).toMatchObject({ ok: true });
    expect(room.match).toMatchObject({ stayA: true, stayB: false });
    expect(room.stay("a")).toEqual({ ok: true });
  });
});

describe("games", () => {
  it("deal starts a match-mode round for the dealer and charges gameDeal", () => {
    const room = matched();
    expect(room.deal("a", CARD)).toMatchObject({ charge: "gameDeal" });
    expect(room.match.game).toEqual({
      cardId: CARD,
      dealtBy: "a",
      mode: "match",
      answerA: null,
      answerB: null,
    });
  });

  it("rejects an unknown card id and leaves the round alone", () => {
    const room = matched();
    expect(room.deal("a", "nope")).toEqual({ ok: false, code: "invalid" });
    expect(room.match.game).toBeNull();
  });

  it("a single answer records the pick without completing the round", () => {
    const room = matched();
    room.deal("a", CARD);
    expect(room.answer("a", CARD, "A")).toMatchObject({ charge: "gameAnswer" });
    expect(room.match.game).toMatchObject({ answerA: "A", answerB: null });
    expect(room.match.gameTally).toEqual({ rounds: 0, matched: 0 });
    expect(room.rows).toHaveLength(0);
  });

  it("agreeing picks tally a match and record a game row", () => {
    const room = matched();
    room.playRound(CARD, "A", "A");
    expect(room.match.gameTally).toEqual({ rounds: 1, matched: 1 });
    expect(room.last()).toMatchObject({
      kind: "game",
      text: "",
      game: {
        cardId: CARD,
        pickA: "A",
        pickB: "A",
        mode: "match",
        dealtBy: "a",
      },
    });
  });

  it("differing picks tally a round without a match", () => {
    const room = matched();
    room.playRound(CARD, "A", "B");
    expect(room.match.gameTally).toEqual({ rounds: 1, matched: 0 });
    expect(room.last().game).toMatchObject({ pickA: "A", pickB: "B" });
  });

  it("first answer wins: a second answer from the same side no-ops", () => {
    const room = matched();
    room.deal("a", CARD);
    room.answer("a", CARD, "A");
    expect(room.answer("a", CARD, "B")).toEqual({ ok: true });
    expect(room.match.game?.answerA).toBe("A");
  });

  it("an answer for a stale card no-ops", () => {
    const room = matched();
    room.deal("a", CARD);
    expect(room.answer("b", OTHER_CARD, "A")).toEqual({ ok: true });
    expect(room.match.game?.answerB).toBeNull();
  });

  it("an answer with no round in flight no-ops", () => {
    const room = matched();
    expect(room.answer("b", CARD, "A")).toEqual({ ok: true });
    expect(room.match.game).toBeNull();
  });

  it("re-dealing replaces the round and discards in-flight answers", () => {
    const room = matched();
    room.deal("a", CARD);
    room.answer("a", CARD, "A");
    room.deal("b", OTHER_CARD);
    expect(room.match.game).toMatchObject({
      cardId: OTHER_CARD,
      dealtBy: "b",
      answerA: null,
    });
    expect(room.match.gameTally).toEqual({ rounds: 0, matched: 0 });
    expect(room.rows).toHaveLength(0);
  });

  it("dismiss clears the round, keeps the tally and the round record", () => {
    const room = matched();
    room.playRound(CARD, "A", "A");
    room.deal("a", OTHER_CARD);
    expect(room.dismiss("b")).toMatchObject({ charge: "gameDeal" });
    expect(room.match.game).toBeNull();
    expect(room.match.gameTally).toEqual({ rounds: 1, matched: 1 });
    expect(room.rows.filter((r) => r.kind === "game")).toHaveLength(1);
  });

  it("dismiss with no round in flight writes nothing", () => {
    const room = matched();
    expect(room.dismiss("a")).toEqual({ ok: true });
  });

  it("tally accumulates across rounds", () => {
    const room = matched();
    room.playRound(GAME_DECKS["this-or-that"][0].id, "A", "A");
    room.playRound(GAME_DECKS["this-or-that"][1].id, "A", "B");
    expect(room.match.gameTally).toEqual({ rounds: 2, matched: 1 });
  });

  it("rejects locked decks and guess mode below their levels", () => {
    const room = matched();
    expect(room.deal("a", GAME_DECKS["hot-takes"][0].id)).toEqual({
      ok: false,
      code: "locked",
    });
    expect(room.deal("a", CARD, "guess")).toEqual({
      ok: false,
      code: "locked",
    });
    expect(room.match.game).toBeNull();
    room.warmUp(4);
    room.deal("a", GAME_DECKS["never-have-i-ever"][0].id, "guess");
    expect(room.match.game).toMatchObject({
      cardId: GAME_DECKS["never-have-i-ever"][0].id,
      mode: "guess",
    });
  });

  it("rate-limits rapid dealing per side", () => {
    const room = new Room({ limits: true });
    const cards = GAME_DECKS["this-or-that"];
    const results = cards.slice(0, 5).map((c) => room.deal("a", c.id));
    expect(results.filter((r) => !r.ok)).toContainEqual({
      ok: false,
      code: "rate_limited",
    });
    // The refused deals wrote nothing; the partner's budget is separate.
    expect(room.deal("b", cards[9].id).ok).toBe(true);
  });
});

describe("guess mode (Mind Reader)", () => {
  const guessRoom = () => {
    const room = matched();
    room.warmUp(2);
    return room;
  };

  it("a correct guess tallies guessTally and leaves gameTally untouched", () => {
    const room = guessRoom();
    room.playRound(CARD, "A", "A", "guess");
    expect(room.match.guessTally).toEqual({ rounds: 1, correct: 1 });
    expect(room.match.gameTally).toEqual({ rounds: 0, matched: 0 });
  });

  it("a wrong guess tallies a round without a hit", () => {
    const room = guessRoom();
    room.playRound(CARD, "A", "B", "guess");
    expect(room.match.guessTally).toEqual({ rounds: 1, correct: 0 });
  });

  it("the completion row carries the mode and the dealer", () => {
    const room = guessRoom();
    room.playRound(CARD, "A", "A", "guess");
    expect(room.last().game).toMatchObject({ mode: "guess", dealtBy: "a" });
  });
});

describe("game streak", () => {
  const cards = GAME_DECKS["this-or-that"];

  it("successes extend it; a miss resets current but keeps best", () => {
    const room = matched();
    room.playRound(cards[0].id, "A", "A");
    room.playRound(cards[1].id, "A", "A");
    expect(room.match.streak).toEqual({ current: 2, best: 2 });
    room.playRound(cards[2].id, "A", "B");
    expect(room.match.streak).toEqual({ current: 0, best: 2 });
  });

  it("a correct guess extends the same streak as a match", () => {
    const room = matched();
    room.warmUp(2);
    room.playRound(cards[0].id, "A", "A");
    room.playRound(cards[1].id, "B", "B", "guess");
    expect(room.match.streak).toEqual({ current: 2, best: 2 });
  });

  it("re-deals and dismissals never touch it", () => {
    const room = matched();
    room.playRound(cards[0].id, "A", "A");
    room.deal("a", cards[1].id);
    room.answer("a", cards[1].id, "A");
    room.deal("b", cards[2].id);
    room.dismiss("a");
    expect(room.match.streak).toEqual({ current: 1, best: 1 });
  });
});

describe("reveal", () => {
  it("is locked until BOTH sides signal stay-connected", () => {
    const room = matched();
    room.stay("a");
    expect(room.submitReveal("a", "@me")).toEqual({
      ok: false,
      code: "not_unlocked",
    });
    expect(room.match.revealA).toBeNull();
  });

  it("stores the own handle and charges revealSubmit", () => {
    const room = mutual();
    expect(room.submitReveal("a", "@me")).toMatchObject({
      charge: "revealSubmit",
    });
    expect(room.match).toMatchObject({ revealA: "@me", revealB: null });
  });

  it("resubmitting replaces pre-reveal; everything freezes post-reveal", () => {
    const room = mutual();
    room.submitReveal("a", "@v1");
    room.submitReveal("a", "@v2");
    expect(room.match.revealA).toBe("@v2");
    room.submitReveal("b", "@bb");
    expect(room.submitReveal("a", "@v3")).toEqual({ ok: true });
    expect(room.withdrawReveal("a")).toEqual({ ok: true });
    expect(room.match).toMatchObject({ revealA: "@v2", revealB: "@bb" });
  });

  it("withdraw clears the own side pre-reveal and no-ops with nothing to clear", () => {
    const room = mutual();
    expect(room.withdrawReveal("a")).toEqual({ ok: true });
    room.submitReveal("a", "@me");
    expect(room.withdrawReveal("a")).toMatchObject({ charge: "revealSubmit" });
    expect(room.match.revealA).toBeNull();
  });

  it("bounds the handle after trimming and ignores whitespace-only", () => {
    const room = mutual();
    expect(
      room.submitReveal("a", "x".repeat(MAX_REVEAL_HANDLE_LEN + 1)),
    ).toEqual({ ok: false, code: "invalid" });
    expect(room.submitReveal("a", "   ")).toEqual({ ok: true });
    expect(room.match.revealA).toBeNull();
    room.submitReveal("a", `  ${"x".repeat(MAX_REVEAL_HANDLE_LEN)}  `);
    expect(room.match.revealA).toBe("x".repeat(MAX_REVEAL_HANDLE_LEN));
  });

  it("rate-limits rapid submissions", () => {
    const room = new Room({ limits: true });
    room.stay("a");
    room.stay("b");
    const results = Array.from({ length: 6 }, (_, i) =>
      room.submitReveal("a", `@v${i}`),
    );
    expect(results).toContainEqual({ ok: false, code: "rate_limited" });
    expect(room.match.revealA).toBe("@v2");
  });
});

describe("ending", () => {
  it("leave ends the match, records the leaver and schedules the purge", () => {
    const room = matched();
    room.now += 500;
    expect(room.leave("b")).toMatchObject({ ok: true, ended: true });
    expect(room.match).toMatchObject({
      status: "ended",
      endedBy: "b",
      endedAt: room.now,
    });
  });

  it("endMatch on absence records no leaver", () => {
    const ended = endMatch(initialMatch(ANA, BEN, 0), 9, null);
    expect(ended).toMatchObject({ status: "ended", endedBy: null, endedAt: 9 });
  });

  it("every op on an ended match is a no-op ack", () => {
    const room = mutual();
    room.send("a", "before");
    room.deal("a", CARD);
    room.leave("b");
    const frozen = room.match;
    const results = [
      room.send("a", "after"),
      room.react("a", 1, "❤️"),
      room.deal("a", OTHER_CARD),
      room.answer("a", CARD, "A"),
      room.dismiss("a"),
      room.stay("a"),
      room.submitReveal("a", "@me"),
      room.withdrawReveal("a"),
      room.leave("a"),
    ];
    for (const res of results) expect(res).toEqual({ ok: true });
    expect(room.match).toBe(frozen);
    expect(room.rows).toHaveLength(1);
  });

  it("an ended match keeps a whisper hidden from a late view", () => {
    const room = matched();
    room.send("a", "psst", { whisper: true });
    room.leave("a");
    expect(room.viewWhisper("b", 1)).toEqual({ ok: true });
    expect(room.row(1)?.whisperViewedAt).toBeNull();
  });

  it("input validation still rejects on an ended match", () => {
    const room = mutual();
    room.leave("a");
    expect(room.send("a", "x".repeat(MAX_MESSAGE_LEN + 1))).toEqual({
      ok: false,
      code: "invalid",
    });
    expect(room.deal("a", "nope")).toEqual({ ok: false, code: "invalid" });
    expect(room.react("a", 1, "nope")).toEqual({ ok: false, code: "invalid" });
  });
});

describe("vibe derived from rows", () => {
  it("messages only count in two-sided pairs", () => {
    const room = matched();
    for (const text of ["one", "two", "three"]) room.send("a", text);
    expect(room.vibe.score).toBe(0);
    room.send("b", "finally");
    expect(room.vibe.score).toBe(2);
  });

  it("a partner's first reaction bumps once; toggles and re-sets never add or remove", () => {
    const room = matched();
    room.send("a", "hey");
    const before = room.vibe.score;
    room.react("b", 1, "🔥");
    expect(room.vibe.score).toBe(before + 2);
    room.react("b", 1, "🔥");
    expect(room.vibe.score).toBe(before + 2);
    room.react("b", 1, "❤️");
    expect(room.vibe.score).toBe(before + 2);
  });

  it("reactions on different partner messages each count", () => {
    const room = matched();
    room.send("a", "one");
    room.send("a", "two");
    room.react("b", 1, "🔥");
    room.react("b", 2, "🔥");
    expect(countVibe(room.rows).reactions).toBe(2);
  });

  it("self-reacts don't feed the meter", () => {
    const room = matched();
    room.send("a", "hey");
    room.react("a", 1, "🔥");
    expect(room.row(1)?.vibeReacted).toBe(false);
    expect(countVibe(room.rows).reactions).toBe(0);
  });

  it("a whisper reveal adds its bonus, and the burn doesn't take it back", () => {
    const room = matched();
    room.send("a", "psst", { whisper: true });
    const before = room.vibe.score;
    room.viewWhisper("b", 1);
    expect(room.vibe.score).toBe(before + 6);
    room.burn(1);
    expect(room.vibe.score).toBe(before + 6);
  });

  it("whispers count as messages; game rows don't", () => {
    const room = matched();
    room.send("a", "psst", { whisper: true });
    room.playRound(CARD, "A", "A");
    expect(countVibe(room.rows)).toMatchObject({ msgsA: 1, msgsB: 0 });
  });

  it("mutual stay-connected adds its bonus only when both tapped", () => {
    const room = matched();
    room.stay("a");
    expect(room.vibe.score).toBe(0);
    room.stay("b");
    expect(room.vibe.score).toBe(20);
  });

  it("completed rounds and successes raise the score", () => {
    const room = matched();
    room.playRound(CARD, "A", "A");
    expect(room.vibe.score).toBe(10);
  });
});
