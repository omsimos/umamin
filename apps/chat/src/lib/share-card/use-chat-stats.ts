import { useEffect, useRef, useState } from "react";
import { MESSAGE_CAP } from "../../../convex/constants";
import type { GameTally, SessionSnapshot } from "../session/types";
import type { ChatReceiptStats } from "./types";

interface Accumulator {
  matchId: string;
  activeSince: number | null;
  seenIds: Set<string>;
  capped: boolean;
  reactionHighWater: number;
  firstTs: number | null;
  lastTs: number | null;
  self: { alias: string; avatarSeed: string };
  partner: { alias: string; avatarSeed: string } | null;
  sharedInterests: string[];
  tally: GameTally;
}

/**
 * Accumulates receipt stats while a chat is active and freezes them the
 * moment it ends — messages are hard-deleted shortly after a match ends, so
 * the receipt must not depend on them staying around. Counts are high-water:
 * the seen-id set outlives the MESSAGE_CAP window, and reactions keep their
 * max (toggling one off doesn't shrink the receipt). On a reload into the
 * post-end grace window the duration falls back to the message-timestamp
 * spread (or is omitted). Returns null until there's something shareable.
 */
export function useChatStats(
  snapshot: SessionSnapshot,
): ChatReceiptStats | null {
  const accRef = useRef<Accumulator | null>(null);
  const [frozen, setFrozen] = useState<ChatReceiptStats | null>(null);

  useEffect(() => {
    const { phase, matchId } = snapshot;
    if ((phase !== "active" && phase !== "ended") || !matchId) return;

    let acc = accRef.current;
    if (!acc || acc.matchId !== matchId) {
      acc = {
        matchId,
        // Only an observed active phase anchors a wall-clock duration.
        activeSince: phase === "active" ? Date.now() : null,
        seenIds: new Set(),
        capped: false,
        reactionHighWater: 0,
        firstTs: null,
        lastTs: null,
        self: {
          alias: snapshot.self.alias,
          avatarSeed: snapshot.self.avatarSeed,
        },
        partner: null,
        sharedInterests: [],
        tally: { rounds: 0, matched: 0 },
      };
      accRef.current = acc;
      if (phase === "active") setFrozen(null);
    }

    for (const m of snapshot.messages) {
      // Game-result rows are records, not messages — the receipt's MESSAGES
      // line counts what people actually said (games get their own line).
      if (!m.gameResult) acc.seenIds.add(m.id);
    }
    if (snapshot.messages.length >= MESSAGE_CAP) acc.capped = true;
    const reactions = snapshot.messages.reduce(
      (n, m) => n + m.reactions.length,
      0,
    );
    acc.reactionHighWater = Math.max(acc.reactionHighWater, reactions);
    const first = snapshot.messages[0];
    const last = snapshot.messages.at(-1);
    if (first) acc.firstTs = acc.firstTs === null ? first.ts : acc.firstTs;
    if (last) acc.lastTs = Math.max(acc.lastTs ?? 0, last.ts);
    if (snapshot.partner) {
      acc.partner = {
        alias: snapshot.partner.alias,
        avatarSeed: snapshot.partner.avatarSeed,
      };
      acc.sharedInterests = snapshot.partner.sharedInterests;
    }
    acc.self = {
      alias: snapshot.self.alias,
      avatarSeed: snapshot.self.avatarSeed,
    };
    if (snapshot.gameTally.rounds > 0) acc.tally = snapshot.gameTally;

    if (phase === "ended" && acc.partner) {
      setFrozen((prev) => {
        if (prev?.matchId === matchId) return prev; // freeze once
        const endedAt = Date.now();
        const partner = acc.partner;
        if (!partner) return prev;
        const durationMs =
          acc.activeSince !== null
            ? endedAt - acc.activeSince
            : acc.firstTs !== null &&
                acc.lastTs !== null &&
                acc.lastTs > acc.firstTs
              ? acc.lastTs - acc.firstTs
              : undefined;
        return {
          matchId,
          self: acc.self,
          partner,
          sharedInterests: acc.sharedInterests,
          ...(durationMs !== undefined ? { durationMs } : {}),
          messageCount: acc.seenIds.size,
          messageCountCapped: acc.capped,
          reactionCount: acc.reactionHighWater,
          endedAt,
          extras:
            acc.tally.rounds > 0
              ? [
                  {
                    label: "VIBE CHECK",
                    value: `${acc.tally.matched}/${acc.tally.rounds} matched`,
                  },
                ]
              : [],
        };
      });
    }
  }, [snapshot]);

  return snapshot.phase === "ended" && frozen?.matchId === snapshot.matchId
    ? frozen
    : null;
}
