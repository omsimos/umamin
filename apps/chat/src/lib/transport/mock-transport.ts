import { randomAlias, randomAvatarSeed } from "../alias";
import { INTERESTS, interestById } from "../content";
import {
  type ChatMessage,
  type ChatTransport,
  type EndedReason,
  IDLE_SNAPSHOT,
  type SelfIdentity,
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

type Rng = () => number;

interface MockTimings {
  matchDelay: number;
  greetingDelay: number;
  partnerReplyDelay: number;
  typingDuration: number;
  stayConnectedReplyDelay: number;
}

const DEFAULT_TIMINGS: MockTimings = {
  matchDelay: 1800,
  greetingDelay: 900,
  partnerReplyDelay: 700,
  typingDuration: 1200,
  stayConnectedReplyDelay: 1400,
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

  function addMessage(msg: Omit<ChatMessage, "id" | "ts" | "reactions">) {
    const message: ChatMessage = {
      id: nextId(),
      ts: msgSeq,
      reactions: [],
      ...msg,
    };
    set({ messages: [...state.messages, message] });
  }

  function partnerSay(text: string, delay: number) {
    schedule(delay, () => {
      if (state.phase !== "active" || !state.partner) return;
      set({ partner: { ...state.partner, status: "typing" } });
      schedule(timings.typingDuration, () => {
        if (state.phase !== "active" || !state.partner) return;
        addMessage({ author: "partner", text });
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

    findMatch(self: SelfIdentity) {
      clearTimers();
      msgSeq = 0;
      matchSeq += 1;
      state = {
        phase: "matching",
        matchId: `match-${matchSeq}`,
        self,
        partner: null,
        messages: [],
        stayConnected: { self: false, partner: false },
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

    send(text: string) {
      const trimmed = text.trim();
      if (state.phase !== "active" || trimmed.length === 0) return;
      addMessage({ author: "self", text: trimmed });
      partnerSay(pick(PARTNER_LINES, random), timings.partnerReplyDelay);
    },

    react(messageId: string, emoji: string) {
      if (state.phase !== "active") return;
      set({
        messages: state.messages.map((m) =>
          m.id === messageId
            ? {
                ...m,
                reactions: m.reactions.includes(emoji)
                  ? m.reactions.filter((e) => e !== emoji)
                  : [...m.reactions, emoji],
              }
            : m,
        ),
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
