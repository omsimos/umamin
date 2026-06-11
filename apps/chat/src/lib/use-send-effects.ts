import { useEffect, useRef, useState } from "react";
import type { ChatMessage, SendEffect } from "./session/types";

/**
 * One-shot playback of message send effects. On the first snapshot for a
 * match the existing backlog is primed silently — a reload must not replay
 * old effects — then each newly arriving effect message plays exactly once
 * (for sender and recipient alike; the sender's own send echoes back).
 */
export function useSendEffects(
  messages: ChatMessage[],
  matchId: string,
): { active: SendEffect | null; clear: () => void } {
  const [active, setActive] = useState<SendEffect | null>(null);
  const playedRef = useRef<Set<string>>(new Set());
  const primedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (primedForRef.current !== matchId) {
      primedForRef.current = matchId;
      playedRef.current = new Set(messages.map((m) => m.id));
      return;
    }
    for (const m of messages) {
      if (m.effect && !playedRef.current.has(m.id)) {
        playedRef.current.add(m.id);
        setActive(m.effect);
      }
    }
  }, [messages, matchId]);

  return { active, clear: () => setActive(null) };
}
