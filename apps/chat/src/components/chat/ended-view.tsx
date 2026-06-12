import { Button } from "@umamin/ui/components/button";
import { ArrowRight, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type {
  EndedReason,
  GameStreak,
  GameTally,
  GuessTally,
  VibeState,
} from "../../lib/session/types";
import { loadCardAssets } from "../../lib/share-card/assets";
import { buildReceiptCard } from "../../lib/share-card/receipt-template";
import type { ChatReceiptStats } from "../../lib/share-card/types";
import { vibeLevelMeta } from "../../lib/vibe-levels";
import { AdContainer } from "../ads/ad-container";
import { ShareCardAction } from "../share/share-card-action";

const TICK_MS = 700;

/** Count-up digits for the afterglow stats — the one non-keyframe animation;
 *  reduced motion (or jsdom) jumps straight to the value. */
function TickUp({ value }: { value: number }) {
  const reduced =
    typeof window.matchMedia !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [shown, setShown] = useState(reduced ? value : 0);
  useEffect(() => {
    if (reduced) {
      setShown(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / TICK_MS);
      setShown(Math.round(value * p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced]);
  return <span className="tabular-nums">{shown}</span>;
}

/** Afterglow: how far the chemistry got before the poof. Hidden for chats
 *  that never got going (level 1, no combo) — no participation trophies. */
function AfterglowCard({
  vibe,
  gameTally,
  guessTally,
  gameStreak,
}: {
  vibe: VibeState;
  gameTally: GameTally;
  guessTally: GuessTally;
  gameStreak: GameStreak;
}) {
  const meta = vibeLevelMeta(vibe.level);
  return (
    <div className="bg-muted/50 relative mb-4 w-full max-w-xs overflow-hidden rounded-xl border px-4 py-3">
      <span
        aria-hidden
        className="animate-shimmer-sweep motion-reduce:animate-none pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0"
      />
      <p className="text-sm font-semibold">
        <span aria-hidden>{meta.emoji}</span> You hit Level {vibe.level} —{" "}
        {meta.name}
      </p>
      <p className="text-muted-foreground mt-1 flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-xs">
        {gameStreak.best >= 2 && (
          <span>
            <span aria-hidden>🔥</span> best combo ×
            <TickUp value={gameStreak.best} />
          </span>
        )}
        {gameTally.rounds > 0 && (
          <span>
            <span aria-hidden>🎯</span> <TickUp value={gameTally.matched} />/
            {gameTally.rounds} matched
          </span>
        )}
        {guessTally.rounds > 0 && (
          <span>
            <span aria-hidden>🔮</span> <TickUp value={guessTally.correct} />/
            {guessTally.rounds} mind reads
          </span>
        )}
      </p>
    </div>
  );
}

// Normal document flow (not an overlay) so the ad below is AdSense-policy-compliant.
export function EndedView({
  reason,
  partnerAlias,
  stats,
  revealedHandle,
  vibe,
  gameTally,
  guessTally,
  gameStreak,
  onFindNew,
  onBackToLobby,
}: {
  reason: EndedReason | undefined;
  partnerAlias: string | undefined;
  /** Frozen receipt stats; null hides the share button (e.g. partner unknown). */
  stats?: ChatReceiptStats | null;
  /** The partner's mutually-revealed handle — shown for copying during the
   *  post-end grace window, gone forever after. Never on the receipt. */
  revealedHandle?: string;
  vibe?: VibeState;
  gameTally?: GameTally;
  guessTally?: GuessTally;
  gameStreak?: GameStreak;
  onFindNew: () => void;
  onBackToLobby: () => void;
}) {
  const title =
    reason === "partner-left" && partnerAlias
      ? `${partnerAlias} left`
      : "Chat ended";
  const showAfterglow =
    vibe && (vibe.level >= 2 || (gameStreak?.best ?? 0) >= 2);

  return (
    <section
      aria-label="Chat ended"
      className="flex flex-1 flex-col items-center justify-center p-6 text-center"
    >
      <div aria-hidden className="mb-3 text-4xl">
        👋
      </div>
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <p className="text-muted-foreground mt-1 mb-5 max-w-xs text-sm">
        Poof — that conversation's gone. Nothing was saved.
      </p>
      {showAfterglow && vibe && (
        <AfterglowCard
          vibe={vibe}
          gameTally={gameTally ?? { rounds: 0, matched: 0 }}
          guessTally={guessTally ?? { rounds: 0, correct: 0 }}
          gameStreak={gameStreak ?? { current: 0, best: 0 }}
        />
      )}
      {revealedHandle && (
        <div className="bg-muted/50 mb-4 w-full max-w-xs rounded-xl border px-4 py-3">
          <p className="text-sm font-medium">
            <span aria-hidden>💞</span> You stayed connected
          </p>
          <div className="mt-1 flex items-center justify-center gap-2">
            <span className="truncate text-sm font-bold">{revealedHandle}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-full text-xs"
              onClick={() =>
                navigator.clipboard
                  ?.writeText(revealedHandle)
                  .then(() => toast("Copied — save it somewhere safe."))
                  .catch(() => toast("Couldn't copy — select it instead."))
              }
            >
              <Copy /> Copy
            </Button>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            Copy it now — this screen won't come back.
          </p>
        </div>
      )}
      <Button className="rounded-full" onClick={onFindNew}>
        Find someone new
        <ArrowRight />
      </Button>
      {stats && (
        <div className="mt-2">
          <ShareCardAction
            label="Share the vibe"
            filename="umamin-chat-receipt.png"
            build={async () => buildReceiptCard(stats, await loadCardAssets())}
          />
        </div>
      )}
      <Button
        variant="ghost"
        className="text-muted-foreground mt-2"
        onClick={onBackToLobby}
      >
        Back to lobby
      </Button>
      <AdContainer placement="ended" className="mt-8 max-w-sm" />
    </section>
  );
}
