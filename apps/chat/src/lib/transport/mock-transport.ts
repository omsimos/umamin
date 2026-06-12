import { REPLY_PREVIEW_LEN, WHISPER_BURN_MS } from "../../../convex/constants";
import { cardById } from "../../../convex/decks";
import {
  computeVibe,
  EMPTY_VIBE_COUNTERS,
  type VibeCounters,
} from "../../../convex/vibe";
import { randomAlias, randomAvatarSeed } from "../alias";
import { INTERESTS, interestById } from "../content";
import {
  type ChatMessage,
  type ChatTransport,
  EMPTY_GUESS_TALLY,
  EMPTY_REVEAL,
  EMPTY_STREAK,
  EMPTY_TALLY,
  EMPTY_VIBE,
  type EndedReason,
  type FindMatchOptions,
  type GameMode,
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
  /** How long after mutual hearts the mock partner drops a handle. */
  revealReplyDelay: number;
}

const DEFAULT_TIMINGS: MockTimings = {
  matchDelay: 1800,
  greetingDelay: 900,
  partnerReplyDelay: 700,
  typingDuration: 1200,
  stayConnectedReplyDelay: 1400,
  whisperViewDelay: 2500,
  gameAnswerDelay: 1600,
  revealReplyDelay: 2600,
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
  // And for the reveal: the mock partner's handle is held here (never on the
  // snapshot) until both sides have submitted — mirror of pendingPartnerPick.
  let pendingPartnerHandle: string | null = null;

  function maybeRevealHandles(next: Partial<SessionSnapshot> = {}) {
    const merged = { ...state, ...next };
    const reveal = merged.reveal;
    if (reveal.self.submitted && pendingPartnerHandle) {
      set({
        ...next,
        reveal: {
          ...reveal,
          partner: { submitted: true, handle: pendingPartnerHandle },
        },
      });
      return;
    }
    if (Object.keys(next).length > 0) set(next);
  }

  // Vibe bookkeeping through the SHARED computeVibe (same import as the
  // server), so the mock can never disagree with the backend on a level.
  let vibeCounters: VibeCounters = { ...EMPTY_VIBE_COUNTERS };

  function refreshVibe(next: Partial<SessionSnapshot> = {}) {
    const merged = { ...state, ...next };
    set({
      ...next,
      vibe: computeVibe({
        ...vibeCounters,
        rounds: merged.gameTally.rounds + merged.guessTally.rounds,
        successes: merged.gameTally.matched + merged.guessTally.correct,
        mutualStayConnected:
          merged.stayConnected.self && merged.stayConnected.partner,
      }),
    });
  }

  function revealRound(selfPick: GamePick, partnerPick: GamePick) {
    if (!state.game) return;
    const { cardId, mode } = state.game;
    // Mirrors the server: equal picks score in both modes (in guess mode the
    // mock partner's prediction matching your truthful pick is a hit).
    const success = selfPick === partnerPick;
    const streakNext = success ? state.gameStreak.current + 1 : 0;
    refreshVibe({
      game: {
        ...state.game,
        selfPick,
        partnerAnswered: true,
        partnerPick,
      },
      gameStreak: {
        current: streakNext,
        best: Math.max(state.gameStreak.best, streakNext),
      },
      ...(mode === "guess"
        ? {
            guessTally: {
              rounds: state.guessTally.rounds + 1,
              correct: state.guessTally.correct + (success ? 1 : 0),
            },
          }
        : {
            gameTally: {
              rounds: state.gameTally.rounds + 1,
              matched: state.gameTally.matched + (success ? 1 : 0),
            },
          }),
    });
    // Mirrors the server: completed rounds become conversation rows.
    addMessage({
      author: "self",
      text: "",
      gameResult: {
        cardId,
        selfPick,
        partnerPick,
        ...(mode === "guess" ? { mode } : {}),
        dealtBy: "self",
      },
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
        vibeCounters.msgsB += 1;
        refreshVibe({ partner: { ...state.partner, status: "online" } });
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
      pendingPartnerHandle = null;
      vibeCounters = { ...EMPTY_VIBE_COUNTERS };
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
        guessTally: EMPTY_GUESS_TALLY,
        gameStreak: EMPTY_STREAK,
        vibe: EMPTY_VIBE,
        reveal: EMPTY_REVEAL,
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
      vibeCounters.msgsA += 1;
      refreshVibe();
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

    dealCard(cardId: string, mode: GameMode = "match") {
      // Mirrors the server: unknown cards are rejected, dealing always
      // replaces the round in flight.
      if (state.phase !== "active" || !cardById(cardId)) return;
      pendingPartnerPick = null;
      set({
        game: {
          cardId,
          dealtBy: "self",
          mode,
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
      vibeCounters.whispers += 1;
      refreshVibe();
      schedule(WHISPER_BURN_MS, () => burnWhisper(messageId));
    },

    react(messageId: string, emoji: string) {
      if (state.phase !== "active") return;
      const target = state.messages.find((m) => m.id === messageId);
      if (!target) return;
      const setting =
        target.reactions.find((r) => r.by === "self")?.emoji !== emoji;
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
      // Set events feed the vibe; toggling off never decrements.
      if (setting) {
        vibeCounters.reactions += 1;
        refreshVibe();
      }
    },

    setTyping(_isTyping: boolean) {
      // No-op: the mock partner simulates its own typing via partnerSay, and
      // there's no remote peer to notify of the local user's typing.
    },

    signalStayConnected() {
      if (state.phase !== "active") return;
      refreshVibe({ stayConnected: { ...state.stayConnected, self: true } });
      schedule(timings.stayConnectedReplyDelay, () => {
        if (state.phase !== "active") return;
        refreshVibe({
          stayConnected: { ...state.stayConnected, partner: true },
        });
        set({ reveal: { ...state.reveal, unlocked: true } });
        // The mock partner drops a handle a beat later — submitted flips, but
        // the handle itself stays withheld until the user submits too (the
        // asymmetric tease, mirrored from the server's anti-leak gate).
        schedule(timings.revealReplyDelay, () => {
          if (state.phase !== "active" || pendingPartnerHandle) return;
          pendingPartnerHandle = `@${state.partner?.alias.toLowerCase().replace(/\s+/g, "") ?? "them"}`;
          maybeRevealHandles({
            reveal: {
              ...state.reveal,
              partner: { ...state.reveal.partner, submitted: true },
            },
          });
        });
      });
    },

    submitRevealHandle(handle: string) {
      const trimmed = handle.trim();
      if (state.phase !== "active" || !trimmed) return;
      const reveal = state.reveal;
      // Mirrors the server: gated on mutual hearts, frozen once both are in.
      if (!reveal.unlocked) return;
      if (reveal.self.handle && reveal.partner.handle) return;
      maybeRevealHandles({
        reveal: {
          ...reveal,
          self: { submitted: true, handle: trimmed },
        },
      });
    },

    withdrawRevealHandle() {
      const reveal = state.reveal;
      if (state.phase !== "active") return;
      if (reveal.self.handle && reveal.partner.handle) return;
      set({ reveal: { ...reveal, self: { submitted: false } } });
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
