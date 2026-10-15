/**
 * Umamin Chat game rules as pure functions. Each op takes the room state it
 * needs plus `now` and returns what to write, with no I/O. The ChatRoom
 * Durable Object loads the rows, charges the returned rate-limit bucket,
 * persists the result and broadcasts projections. Keeping the rules here lets
 * them run under the plain node test runner.
 */
import {
  ALLOWED_EFFECTS,
  ALLOWED_REACTIONS,
  MAX_MESSAGE_LEN,
  MAX_REVEAL_HANDLE_LEN,
  MAX_ROOM_MESSAGES,
  type SendEffect,
  WHISPER_BURN_MS,
} from "./constants";
import { cardById } from "./decks";
import type { LimiterName } from "./limits";
import type { ServerErrorCode } from "./protocol";
import type { GameMode, GamePick } from "./types";

export type Side = "a" | "b";

export function otherSide(side: Side): Side {
  return side === "a" ? "b" : "a";
}

export interface Participant {
  alias: string;
  avatarSeed: string;
  interests: string[];
}

export interface GameRow {
  cardId: string;
  dealtBy: Side;
  mode: GameMode;
  answerA: GamePick | null;
  answerB: GamePick | null;
}

/** The room's single `match` row, minus the credentials the adapter keeps. */
export interface MatchState {
  a: Participant;
  b: Participant;
  sharedInterests: string[];
  stayA: boolean;
  stayB: boolean;
  /** Each side has authenticated at least once. Both true = the start grace
   *  no longer applies and an absent side reads as "away". */
  seenA: boolean;
  seenB: boolean;
  game: GameRow | null;
  gameTally: { rounds: number; matched: number };
  guessTally: { rounds: number; correct: number };
  streak: { current: number; best: number };
  revealA: string | null;
  revealB: string | null;
  status: "active" | "ended";
  /** Set only on a voluntary leave; an absence end leaves it null so both
   *  sides read "partner-left". */
  endedBy: Side | null;
  endedAt: number | null;
  createdAt: number;
}

export interface GameRecord {
  cardId: string;
  pickA: GamePick;
  pickB: GamePick;
  mode: GameMode;
  dealtBy: Side;
}

export interface MessageRow {
  seq: number;
  author: Side;
  text: string;
  reactionA: string | null;
  reactionB: string | null;
  replyTo: number | null;
  kind: "whisper" | "game" | null;
  whisperViewedAt: number | null;
  burned: boolean;
  game: GameRecord | null;
  effect: SendEffect | null;
  createdAt: number;
}

export type NewMessage = Omit<MessageRow, "seq">;

export type ChatErrorCode = ServerErrorCode;

/** What an op wants written. Absent fields mean "unchanged". `noop` ops still
 *  ack so the client can settle optimistic UI. */
export type OpResult =
  | { ok: false; code: ChatErrorCode }
  | {
      ok: true;
      /** Bucket to charge before applying; if empty the op fails rate_limited
       *  and nothing is written. */
      charge?: LimiterName;
      match?: MatchState;
      insert?: NewMessage;
      update?: MessageRow;
      /** Schedule the whisper burn for this message. */
      burnAt?: number;
      /** Schedule the storage purge (the match just ended). */
      ended?: boolean;
    };

const NOOP: OpResult = { ok: true };

export function initialMatch(
  a: Participant,
  b: Participant,
  now: number,
): MatchState {
  return {
    a,
    b,
    sharedInterests: a.interests.filter((i) => b.interests.includes(i)),
    stayA: false,
    stayB: false,
    seenA: false,
    seenB: false,
    game: null,
    gameTally: { rounds: 0, matched: 0 },
    guessTally: { rounds: 0, correct: 0 },
    streak: { current: 0, best: 0 },
    revealA: null,
    revealB: null,
    status: "active",
    endedBy: null,
    endedAt: null,
    createdAt: now,
  };
}

/** Everything an op may consult. */
export interface OpContext {
  match: MatchState;
  side: Side;
  now: number;
}

const isActive = (ctx: OpContext) => ctx.match.status === "active";

export function send(
  ctx: OpContext,
  input: {
    text: string;
    whisper?: boolean;
    effect?: string;
    /** The reply target, already loaded from THIS room (or null if the seq
     *  didn't resolve). A missing target drops the reference, not the message. */
    replyTarget: MessageRow | null;
    messageCount: number;
  },
): OpResult {
  const text = input.text.trim();
  if (!text) return NOOP;
  if (text.length > MAX_MESSAGE_LEN) return { ok: false, code: "invalid" };
  const effect = input.effect;
  if (effect && !(ALLOWED_EFFECTS as readonly string[]).includes(effect)) {
    return { ok: false, code: "invalid" };
  }
  if (!isActive(ctx)) return NOOP;
  if (input.messageCount >= MAX_ROOM_MESSAGES) {
    return { ok: false, code: "cap" };
  }
  // Whisper and effect are mutually exclusive: whisper wins.
  const keptEffect = !input.whisper && effect ? (effect as SendEffect) : null;
  return {
    ok: true,
    charge: "sendMessage",
    insert: {
      author: ctx.side,
      text,
      reactionA: null,
      reactionB: null,
      replyTo: input.replyTarget?.seq ?? null,
      kind: input.whisper ? "whisper" : null,
      whisperViewedAt: null,
      burned: false,
      game: null,
      effect: keptEffect,
      createdAt: ctx.now,
    },
  };
}

export function viewWhisper(ctx: OpContext, msg: MessageRow | null): OpResult {
  if (!isActive(ctx) || !msg) return NOOP;
  // Only the recipient starts the burn; idempotent so a double tap or reload
  // can't restart the countdown.
  if (msg.author === ctx.side) return NOOP;
  if (msg.kind !== "whisper" || msg.burned || msg.whisperViewedAt) return NOOP;
  return {
    ok: true,
    update: { ...msg, whisperViewedAt: ctx.now },
    burnAt: ctx.now + WHISPER_BURN_MS,
  };
}

/** Timer path: redact a whisper whose countdown ran out. */
export function burnWhisper(msg: MessageRow | null): MessageRow | null {
  if (msg?.kind !== "whisper" || msg.burned) return null;
  return { ...msg, burned: true, text: "" };
}

export function react(
  ctx: OpContext,
  msg: MessageRow | null,
  emoji: string,
): OpResult {
  if (!ALLOWED_REACTIONS.includes(emoji)) return { ok: false, code: "invalid" };
  if (!isActive(ctx) || !msg) return NOOP;
  const current = ctx.side === "a" ? msg.reactionA : msg.reactionB;
  const next = current === emoji ? null : emoji;
  return {
    ok: true,
    charge: "react",
    update: {
      ...msg,
      ...(ctx.side === "a" ? { reactionA: next } : { reactionB: next }),
    },
  };
}

export function stayConnected(ctx: OpContext): OpResult {
  if (!isActive(ctx)) return NOOP;
  const key = ctx.side === "a" ? "stayA" : "stayB";
  if (ctx.match[key]) return NOOP;
  return { ok: true, match: { ...ctx.match, [key]: true } };
}

export function dealCard(
  ctx: OpContext,
  cardId: string,
  mode: GameMode | undefined,
): OpResult {
  const card = cardById(cardId);
  if (!card) return { ok: false, code: "invalid" };
  if (!isActive(ctx)) return NOOP;
  // Dealing always replaces the current round, answered or not. Discarded
  // rounds never reach the tally, and this is the escape hatch when a partner
  // never answers.
  return {
    ok: true,
    charge: "gameDeal",
    match: {
      ...ctx.match,
      game: {
        cardId,
        dealtBy: ctx.side,
        mode: mode ?? "match",
        answerA: null,
        answerB: null,
      },
    },
  };
}

export function answerCard(
  ctx: OpContext,
  cardId: string,
  pick: GamePick,
): OpResult {
  const game = ctx.match.game;
  // Stale-round guard: the round was replaced between render and tap.
  if (!isActive(ctx) || !game || game.cardId !== cardId) return NOOP;
  const key = ctx.side === "a" ? "answerA" : "answerB";
  if (game[key]) return NOOP; // first answer wins
  const next: GameRow = { ...game, [key]: pick };
  if (!next.answerA || !next.answerB) {
    return {
      ok: true,
      charge: "gameAnswer",
      match: { ...ctx.match, game: next },
    };
  }
  // One expression for both modes: in "match" equal picks are a match, in
  // "guess" the prediction equalling the dealer's truth is a hit.
  const success = next.answerA === next.answerB;
  const { streak, gameTally, guessTally } = ctx.match;
  return {
    ok: true,
    charge: "gameAnswer",
    match: {
      ...ctx.match,
      game: next,
      streak: success
        ? {
            current: streak.current + 1,
            best: Math.max(streak.best, streak.current + 1),
          }
        : { current: 0, best: streak.best },
      ...(next.mode === "guess"
        ? {
            guessTally: {
              rounds: guessTally.rounds + 1,
              correct: guessTally.correct + (success ? 1 : 0),
            },
          }
        : {
            gameTally: {
              rounds: gameTally.rounds + 1,
              matched: gameTally.matched + (success ? 1 : 0),
            },
          }),
    },
    // Completed rounds live in the conversation. Inserted only at completion,
    // so an unanswered partner can't read an early pick off the row.
    insert: {
      author: ctx.side,
      text: "",
      reactionA: null,
      reactionB: null,
      replyTo: null,
      kind: "game",
      whisperViewedAt: null,
      burned: false,
      game: {
        cardId: next.cardId,
        pickA: next.answerA,
        pickB: next.answerB,
        mode: next.mode,
        dealtBy: next.dealtBy,
      },
      effect: null,
      createdAt: ctx.now,
    },
  };
}

export function dismissGame(ctx: OpContext): OpResult {
  if (!isActive(ctx) || !ctx.match.game) return NOOP;
  // Shares the deal budget: dismissing is the same round-management action.
  return { ok: true, charge: "gameDeal", match: { ...ctx.match, game: null } };
}

export function submitReveal(ctx: OpContext, handle: string): OpResult {
  const trimmed = handle.trim();
  if (!trimmed) return NOOP;
  if (trimmed.length > MAX_REVEAL_HANDLE_LEN) {
    return { ok: false, code: "invalid" };
  }
  // A handle can never be written after the end.
  if (!isActive(ctx)) return NOOP;
  if (!(ctx.match.stayA && ctx.match.stayB)) {
    return { ok: false, code: "not_unlocked" };
  }
  // Frozen once mutually revealed, so nobody can bait-and-switch after seeing
  // the partner's handle. Before that, resubmitting replaces.
  if (ctx.match.revealA && ctx.match.revealB) return NOOP;
  return {
    ok: true,
    charge: "revealSubmit",
    match: {
      ...ctx.match,
      ...(ctx.side === "a" ? { revealA: trimmed } : { revealB: trimmed }),
    },
  };
}

export function withdrawReveal(ctx: OpContext): OpResult {
  if (!isActive(ctx)) return NOOP;
  if (ctx.match.revealA && ctx.match.revealB) return NOOP;
  const key = ctx.side === "a" ? "revealA" : "revealB";
  if (!ctx.match[key]) return NOOP;
  return {
    ok: true,
    charge: "revealSubmit",
    match: { ...ctx.match, [key]: null },
  };
}

export function leave(ctx: OpContext): OpResult {
  if (!isActive(ctx)) return NOOP;
  return {
    ok: true,
    match: endMatch(ctx.match, ctx.now, ctx.side),
    ended: true,
  };
}

/** Ends an active match. `by` is the side that left voluntarily, or null when
 *  a grace ran out (absence or a partner who never connected). */
export function endMatch(
  match: MatchState,
  now: number,
  by: Side | null,
): MatchState {
  return { ...match, status: "ended", endedBy: by, endedAt: now };
}

/** Marks a side as having authenticated at least once. Returns null when
 *  nothing changes, so a reconnect doesn't rewrite the row. */
export function markSeen(match: MatchState, side: Side): MatchState | null {
  const key = side === "a" ? "seenA" : "seenB";
  return match[key] ? null : { ...match, [key]: true };
}

export function bothSeen(match: MatchState): boolean {
  return match.seenA && match.seenB;
}
