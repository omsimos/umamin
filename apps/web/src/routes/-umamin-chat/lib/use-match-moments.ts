import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { SendEffect, SessionSnapshot } from "@/lib/chat/types";

/** One full-screen moment at a time, so the two can never stack. */
export type MatchOverlay = "celebration" | "reveal" | null;

interface Shown {
  matchId: string;
  effect: SendEffect | null;
  overlay: MatchOverlay;
  iceBreakerDismissed: boolean;
}

/** What has already had its moment this match. Seeded from the first
 *  snapshot of a match, so a reload never replays any of it. */
interface Seen {
  matchId: string;
  effects: Set<string>;
  teased: boolean;
  celebrated: boolean;
  revealed: boolean;
}

const NOTHING_SHOWN = {
  effect: null,
  overlay: null,
  iceBreakerDismissed: false,
} as const;

export interface MatchMoments {
  /** The send effect playing now. */
  effect: SendEffect | null;
  overlay: MatchOverlay;
  iceBreakerDismissed: boolean;
  clearEffect: () => void;
  closeOverlay: () => void;
  dismissIceBreaker: () => void;
}

/**
 * The one-shot UI moments of a match: send effects, the "It's mutual!"
 * celebration, the partner's reveal tease and the handle reveal, plus the
 * ice-breaker dismissal. All of it is keyed on the match, so nothing left
 * over from one match (an effect cut short by the match ending, say) can
 * show in the next.
 */
export function useMatchMoments(
  snapshot: SessionSnapshot,
  handlers: {
    /** The partner submitted a handle first. Never says what it is. */
    onTease: (partnerAlias: string) => void;
    /** Both handles landed and the reveal overlay opens. */
    onReveal: () => void;
  },
): MatchMoments {
  const { matchId, phase, messages, partner, reveal, stayConnected } = snapshot;
  const [state, setState] = useState<Shown>({ matchId, ...NOTHING_SHOWN });
  // A new match shows nothing from the last one, from its first render on.
  const shown =
    state.matchId === matchId ? state : { matchId, ...NOTHING_SHOWN };

  function update(patch: Partial<Omit<Shown, "matchId">>) {
    setState((prev) => ({
      ...(prev.matchId === matchId ? prev : { matchId, ...NOTHING_SHOWN }),
      ...patch,
    }));
  }

  const tease = useEffectEvent(handlers.onTease);
  const revealed = useEffectEvent(handlers.onReveal);
  const mutual = stayConnected.self && stayConnected.partner;
  const bothRevealed = Boolean(reveal.self.handle && reveal.partner.handle);
  const partnerAlias = partner?.alias;

  const seen = useRef<Seen | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: update only closes over matchId
  useEffect(() => {
    if (!matchId) return;
    const s = seen.current;
    if (s?.matchId !== matchId) {
      seen.current = {
        matchId,
        effects: new Set(messages.map((m) => m.id)),
        teased: reveal.partner.submitted,
        celebrated: mutual,
        revealed: bothRevealed,
      };
      return;
    }
    for (const m of messages) {
      // An unacked send plays nothing: the acked copy arrives under a new id
      // and plays then, so the sender sees the effect once.
      if (m.effect && !m.delivery && !s.effects.has(m.id)) {
        s.effects.add(m.id);
        update({ effect: m.effect });
      }
    }
    if (
      reveal.partner.submitted &&
      !bothRevealed &&
      !s.teased &&
      phase === "active" &&
      partnerAlias
    ) {
      s.teased = true;
      tease(partnerAlias);
    }
    if (mutual && !s.celebrated) {
      s.celebrated = true;
      if (phase === "active") update({ overlay: "celebration" });
    }
    if (bothRevealed && !s.revealed) {
      s.revealed = true;
      if (phase === "active") {
        revealed();
        update({ overlay: "reveal" });
      }
    }
  }, [
    matchId,
    messages,
    reveal.partner.submitted,
    bothRevealed,
    mutual,
    phase,
    partnerAlias,
  ]);

  return {
    effect: shown.effect,
    overlay: shown.overlay,
    iceBreakerDismissed: shown.iceBreakerDismissed,
    clearEffect: () => update({ effect: null }),
    closeOverlay: () => update({ overlay: null }),
    dismissIceBreaker: () => update({ iceBreakerDismissed: true }),
  };
}
