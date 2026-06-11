import { REPLY_PREVIEW_LEN, WHISPER_BURN_MS } from "../../../convex/constants";
import { cardById } from "../../../convex/decks";
import { randomAlias, randomAvatarSeed } from "../alias";
import { INTERESTS, interestById } from "../content";
import {
  type ChatMessage,
  type ChatTransport,
  EMPTY_TALLY,
  type EndedReason,
  type FindMatchOptions,
  type GamePick,
  IDLE_SNAPSHOT,
  type SelfIdentity,
  type SendOpts,
  type SessionSnapshot,
} from "../session/types";

const PARTNER_LINES = [
  "haha that's so real",
  "ooh tell me more",
  "honestly same",
  "wait that's actually interesting",
  "no way 😄",
  "i've been thinking about that too lately",
  "okay that's a hot take",
  "what got you into that?",
  "lol fair enough",
  "that's kind of the dream tbh",
];

const WHISPER_BACK_LINES = [
  "👀 ok here's a secret of mine too…",
  "promise this stays between us",
  "i've never told anyone this",
];

type Rng = () => number;

interface MockTimings {
  matchDelay: number;
  greetingDelay: number;
  partnerReplyDelay: number;
  typingDuration: number;
  stayConnectedReplyDelay: number;
  /** How long the mock partner takes to "tap" a whisper you sent. */
  whisperViewDelay: number;
  /** How long the mock partner takes to pick a game answer. */
  gameAnswerDelay: number;
}

const DEFAULT_TIMINGS: MockTimings = {
  matchDelay: 1800,
  greetingDelay: 900,
  partnerReplyDelay: 700,
  typingDuration: 1200,
  stayConnectedReplyDelay: 1400,
  whisperViewDelay: 2500,
  gameAnswerDelay: 1600,
};

export interface MockTransportOptions {
  random?: Rng;
  timings?: Partial<MockTimings>;
}

function pick<T>(list: T[], random: Rng): T {
  return list[Math.floor(random() * list.length)];
}

function pickShared(interests: string[], random: Rng): string[] {
  if (interests.length > 0) return [pick(interests, random)];
  return [pick(INTERESTS, random).id];
}

function greeting(sharedInterestIds: string[], random: Rng): string {
  const label = interestById(sharedInterestIds[0])?.label ?? "that";
  const openers = [
    `hey! saw we both like ${label} — what got you into it?`,
    `oh nice, a fellow ${label} person 👀 how's it going?`,
    `hey there! ${label} squad apparently. what's up?`,
  ];
  return pick(openers, random);
}

export function createMockTransport(
  options: MockTransportOptions = {},
): ChatTransport {
  const random = options.random ?? Math.random;
  const timings = { ...DEFAULT_TIMINGS, ...options.timings };

  let state: SessionSnapshot = IDLE_SNAPSHOT;
  const listeners = new Set<(s: SessionSnapshot) => void>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let msgSeq = 0;
  let matchSeq = 0;

  function emit() {
    for (const l of listeners) l(state);
  }

  function set(next: Partial<SessionSnapshot>) {
    state = { ...state, ...next };
    emit();
  }

  function schedule(ms: number, fn: () => void) {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  }

  function clearTimers() {
    for (const id of timers) clearTimeout(id);
    timers.clear();
  }

  function nextId(): string {
    msgSeq += 1;
    return `m${msgSeq}`;
  }

  // Mirrors the server's anti-leak: a partner whisper's plaintext is held here
  // (never on the snapshot) until viewWhisper swaps it in.
  const hiddenWhisperText = new Map<string, string>();
  // Same gate for game rounds: the mock partner's pick stays off the snapshot
  // until both sides have answered.
  let pendingPartnerPick: GamePick | null = null;

  function revealRound(selfPick: GamePick, partnerPick: GamePick) {
    if (!state.game) return;
    const { cardId } = state.game;
    set({
      game: {
        ...state.game,
        selfPick,
        partnerAnswered: true,
        partnerPick,
      },
      gameTally: {
        rounds: state.gameTally.rounds + 1,
        matched: state.gameTally.matched + (selfPick === partnerPick ? 1 : 0),
      },
    });
    // Mirrors the server: completed rounds become conversation rows.
    addMessage({
      author: "self",
      text: "",
      gameResult: { cardId, selfPick, partnerPick },
    });
  }

  function addMessage(
    msg: Omit<ChatMessage, "id" | "ts" | "reactions">,
  ): string {
    const message: ChatMessage = {
      id: nextId(),
      ts: msgSeq,
      reactions: [],
      ...msg,
    };
    set({ messages: [...state.messages, message] });
    return message.id;
  }

  function updateMessage(id: string, fn: (m: ChatMessage) => ChatMessage) {
    set({ messages: state.messages.map((m) => (m.id === id ? fn(m) : m)) });
  }

  function burnWhisper(id: string) {
    hiddenWhisperText.delete(id);
    updateMessage(id, (m) =>
      m.whisper && m.whisper.state !== "burned"
        ? { ...m, text: "", whisper: { state: "burned" } }
        : m,
    );
  }

  function partnerSay(text: string, delay: number, whisper = false) {
    schedule(delay, () => {
      if (state.phase !== "active" || !state.partner) return;
      set({ partner: { ...state.partner, status: "typing" } });
      schedule(timings.typingDuration, () => {
        if (state.phase !== "active" || !state.partner) return;
        if (whisper) {
          // Hidden whisper: empty text on the snapshot, plaintext in the map.
          const id = addMessage({
            author: "partner",
            text: "",
            whisper: { state: "hidden" },
          });
          hiddenWhisperText.set(id, text);
        } else {
          addMessage({ author: "partner", text });
        }
        set({ partner: { ...state.partner, status: "online" } });
      });
    });
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getSnapshot() {
      return state;
    },

    findMatch(self: SelfIdentity, options?: FindMatchOptions) {
      // There's no real host in the mock, so a join is always a miss — the
      // visitor still gets a normal simulated match.
      if (options?.joinCode) options.onInviteMiss?.();
      clearTimers();
      hiddenWhisperText.clear();
      pendingPartnerPick = null;
      msgSeq = 0;
      matchSeq += 1;
      state = {
        phase: "matching",
        matchId: `match-${matchSeq}`,
        self,
        partner: null,
        messages: [],
        stayConnected: { self: false, partner: false },
        game: null,
        gameTally: EMPTY_TALLY,
      };
      emit();
      schedule(timings.matchDelay, () => {
        const sharedInterests = pickShared(self.interests, random);
        set({
          phase: "active",
          partner: {
            alias: randomAlias(random),
            avatarSeed: randomAvatarSeed(random),
            sharedInterests,
            status: "online",
          },
        });
        partnerSay(greeting(sharedInterests, random), timings.greetingDelay);
      });
    },

    send(text: string, opts?: SendOpts) {
      const trimmed = text.trim();
      if (state.phase !== "active" || trimmed.length === 0) return;
      // Mirrors the server: an unknown reply target drops the reference, not
      // the message; the preview is a truncated snapshot of the target.
      const target = opts?.replyToId
        ? state.messages.find((m) => m.id === opts.replyToId)
        : undefined;
      const whisper = Boolean(opts?.whisper);
      const id = addMessage({
        author: "self",
        text: trimmed,
        ...(target
          ? {
              replyTo: {
                id: target.id,
                author: target.author,
                text: target.whisper
                  ? "🔥 Whisper"
                  : target.text.slice(0, REPLY_PREVIEW_LEN),
              },
            }
          : {}),
        ...(whisper ? { whisper: { state: "hidden" as const } } : {}),
        ...(opts?.effect && !whisper ? { effect: opts.effect } : {}),
      });
      if (whisper) {
        // The mock partner "taps" your whisper, then it burns — and whispers
        // one back so the recipient flow is playable offline.
        schedule(timings.whisperViewDelay, () => {
          updateMessage(id, (m) =>
            m.whisper?.state === "hidden"
              ? { ...m, whisper: { state: "revealed", viewedAt: Date.now() } }
              : m,
          );
          schedule(WHISPER_BURN_MS, () => burnWhisper(id));
        });
        partnerSay(
          pick(WHISPER_BACK_LINES, random),
          timings.partnerReplyDelay,
          true,
        );
        return;
      }
      partnerSay(pick(PARTNER_LINES, random), timings.partnerReplyDelay);
    },

    dealCard(cardId: string) {
      // Mirrors the server: unknown cards are rejected, dealing always
      // replaces the round in flight.
      if (state.phase !== "active" || !cardById(cardId)) return;
      pendingPartnerPick = null;
      set({
        game: {
          cardId,
          dealtBy: "self",
          selfPick: null,
          partnerAnswered: false,
        },
      });
      schedule(timings.gameAnswerDelay, () => {
        const g = state.game;
        if (state.phase !== "active" || g?.cardId !== cardId) return;
        const pick: GamePick = random() < 0.5 ? "A" : "B";
        if (g.selfPick) {
          revealRound(g.selfPick, pick);
        } else {
          pendingPartnerPick = pick;
          set({ game: { ...g, partnerAnswered: true } });
        }
      });
    },

    answerCard(cardId: string, pick: GamePick) {
      const g = state.game;
      if (state.phase !== "active" || !g || g.cardId !== cardId || g.selfPick)
        return;
      if (pendingPartnerPick) {
        revealRound(pick, pendingPartnerPick);
        pendingPartnerPick = null;
      } else {
        set({ game: { ...g, selfPick: pick } });
      }
    },

    dismissGame() {
      if (state.phase !== "active" || !state.game) return;
      pendingPartnerPick = null;
      set({ game: null });
    },

    viewWhisper(messageId: string) {
      if (state.phase !== "active") return;
      const msg = state.messages.find((m) => m.id === messageId);
      // Recipient-only, idempotent — mirrors the server guards.
      if (msg?.author !== "partner" || msg.whisper?.state !== "hidden") {
        return;
      }
      const plaintext = hiddenWhisperText.get(messageId) ?? "";
      hiddenWhisperText.delete(messageId);
      updateMessage(messageId, (m) => ({
        ...m,
        text: plaintext,
        whisper: { state: "revealed", viewedAt: Date.now() },
      }));
      schedule(WHISPER_BURN_MS, () => burnWhisper(messageId));
    },

    react(messageId: string, emoji: string) {
      if (state.phase !== "active") return;
      // Mirrors the server: one reaction per user — repeating the current
      // emoji clears it, a different one replaces it.
      set({
        messages: state.messages.map((m) => {
          if (m.id !== messageId) return m;
          const mine = m.reactions.find((r) => r.by === "self");
          const others = m.reactions.filter((r) => r.by !== "self");
          return {
            ...m,
            reactions:
              mine?.emoji === emoji
                ? others
                : [...others, { emoji, by: "self" as const }],
          };
        }),
      });
    },

    setTyping(_isTyping: boolean) {
      // No-op: the mock partner simulates its own typing via partnerSay, and
      // there's no remote peer to notify of the local user's typing.
    },

    signalStayConnected() {
      if (state.phase !== "active") return;
      set({ stayConnected: { ...state.stayConnected, self: true } });
      schedule(timings.stayConnectedReplyDelay, () => {
        if (state.phase !== "active") return;
        set({ stayConnected: { ...state.stayConnected, partner: true } });
      });
    },

    leave(reason: EndedReason = "self-ended") {
      clearTimers();
      set({
        phase: "ended",
        endedReason: reason,
        partner: state.partner ? { ...state.partner, status: "left" } : null,
      });
    },
  };
}
