/**
 * Viewer-relative projection: the only place a room frame is shaped for one
 * side. The anti-leak rules live here and nowhere else:
 * - a hidden whisper's text never reaches the recipient (blur alone would be
 *   theater), and a burned whisper is empty for both sides;
 * - the partner's game pick appears only once both sides have answered;
 * - the partner's reveal handle appears only once both sides have submitted;
 * - session ids and sides never leave the room; authors become self/partner.
 */
import { REPLY_PREVIEW_LEN } from "./constants";
import {
  type MatchState,
  type MessageRow,
  otherSide,
  type Side,
} from "./engine";
import type {
  ChatMessage,
  PartnerStatus,
  SnapshotMeta,
  WhisperState,
} from "./types";

/** Placeholder for quoted whispers: a reply preview must not outlive the burn. */
export const WHISPER_PREVIEW = "🔥 Whisper";
/** Placeholder for quoted game rows (they carry no text). */
export const GAME_PREVIEW = "⚡ Game round";

const perspective = (author: Side, viewer: Side) =>
  author === viewer ? ("self" as const) : ("partner" as const);

export function projectMeta(
  match: MatchState,
  viewer: Side,
  partnerOnline: boolean,
  matchId: string,
): SnapshotMeta {
  const partner = otherSide(viewer);
  const ended = match.status === "ended";
  const partnerSeen = partner === "a" ? match.seenA : match.seenB;
  // A partner who has never connected is still connecting right after the
  // pair and reads as online; the start grace bounds how long that lasts.
  const status: PartnerStatus = ended
    ? "left"
    : partnerOnline || !partnerSeen
      ? "online"
      : "away";

  const g = match.game;
  const myPick = g ? (viewer === "a" ? g.answerA : g.answerB) : null;
  const theirPick = g ? (viewer === "a" ? g.answerB : g.answerA) : null;
  const myReveal = viewer === "a" ? match.revealA : match.revealB;
  const theirReveal = viewer === "a" ? match.revealB : match.revealA;
  const bothRevealed = Boolean(match.revealA && match.revealB);
  const self = match[viewer];
  const other = match[partner];

  return {
    phase: ended ? "ended" : "active",
    matchId,
    self: {
      alias: self.alias,
      avatarSeed: self.avatarSeed,
      interests: self.interests,
    },
    partner: {
      alias: other.alias,
      avatarSeed: other.avatarSeed,
      sharedInterests: match.sharedInterests,
      status,
    },
    stayConnected: {
      self: viewer === "a" ? match.stayA : match.stayB,
      partner: viewer === "a" ? match.stayB : match.stayA,
    },
    game: g
      ? {
          cardId: g.cardId,
          dealtBy: perspective(g.dealtBy, viewer),
          mode: g.mode,
          selfPick: myPick,
          partnerAnswered: Boolean(theirPick),
          ...(myPick && theirPick ? { partnerPick: theirPick } : {}),
        }
      : null,
    gameTally: match.gameTally,
    guessTally: match.guessTally,
    gameStreak: match.streak,
    reveal: {
      unlocked: match.stayA && match.stayB,
      self: {
        submitted: Boolean(myReveal),
        ...(myReveal ? { handle: myReveal } : {}),
      },
      partner: {
        submitted: Boolean(theirReveal),
        ...(bothRevealed && theirReveal ? { handle: theirReveal } : {}),
      },
    },
    ...(ended
      ? {
          endedReason:
            match.endedBy === viewer
              ? ("self-ended" as const)
              : ("partner-left" as const),
        }
      : {}),
  };
}

function whisperState(row: MessageRow): WhisperState["state"] | null {
  if (row.kind !== "whisper") return null;
  if (row.burned) return "burned";
  return row.whisperViewedAt ? "revealed" : "hidden";
}

/** `replyTarget` is the row `row.replyTo` points at, if it still exists.
 *  `clientId` is the send op id that stored the row; only its author sees it. */
export function projectMessage(
  row: MessageRow,
  viewer: Side,
  replyTarget: MessageRow | null,
  clientId?: string | null,
): ChatMessage {
  const isAuthor = row.author === viewer;
  const whisper = whisperState(row);
  const text =
    whisper === null
      ? row.text
      : whisper === "burned"
        ? ""
        : isAuthor || whisper === "revealed"
          ? row.text
          : "";

  return {
    id: String(row.seq),
    author: perspective(row.author, viewer),
    text,
    ts: row.createdAt,
    // A-then-B order keeps the array deterministic for both viewers.
    reactions: [
      ...(row.reactionA
        ? [{ emoji: row.reactionA, by: perspective("a", viewer) }]
        : []),
      ...(row.reactionB
        ? [{ emoji: row.reactionB, by: perspective("b", viewer) }]
        : []),
    ],
    ...(replyTarget
      ? {
          replyTo: {
            id: String(replyTarget.seq),
            author: perspective(replyTarget.author, viewer),
            text:
              replyTarget.kind === "whisper"
                ? WHISPER_PREVIEW
                : replyTarget.kind === "game"
                  ? GAME_PREVIEW
                  : replyTarget.text.slice(0, REPLY_PREVIEW_LEN),
          },
        }
      : {}),
    ...(whisper
      ? {
          whisper: {
            state: whisper,
            ...(whisper === "revealed" && row.whisperViewedAt
              ? { viewedAt: row.whisperViewedAt }
              : {}),
          },
        }
      : {}),
    ...(row.effect ? { effect: row.effect } : {}),
    ...(clientId && isAuthor ? { clientId } : {}),
    ...(row.kind === "game" && row.game
      ? {
          gameResult: {
            cardId: row.game.cardId,
            selfPick: viewer === "a" ? row.game.pickA : row.game.pickB,
            partnerPick: viewer === "a" ? row.game.pickB : row.game.pickA,
            ...(row.game.mode === "guess" ? { mode: row.game.mode } : {}),
            dealtBy: perspective(row.game.dealtBy, viewer),
          },
        }
      : {}),
  };
}
