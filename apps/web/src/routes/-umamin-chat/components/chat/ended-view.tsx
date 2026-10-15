import { Button } from "@umamin/ui/components/button";
import {
  ArrowRightIcon,
  CopyIcon,
  MessageCircleOffIcon,
  Share2Icon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ClientOnlyAdContainer } from "@/components/ad-container-client";
import type {
  EndedReason,
  GameStreak,
  GameTally,
  GuessTally,
} from "@/lib/chat/types";
import { loadCardAssets } from "../../lib/share-card/assets";
import { buildReceiptCard } from "../../lib/share-card/receipt-template";
import type { ChatReceiptStats } from "../../lib/share-card/types";
import { ShareCardAction } from "../share/share-card-action";

const TICK_MS = 700;

/** Count-up digits for the afterglow stats, the one non-keyframe animation;
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

/** Afterglow: a recap of the games before the poof. The caller hides it
 *  when no round was completed. */
function AfterglowCard({
  gameTally,
  guessTally,
  gameStreak,
}: {
  gameTally: GameTally;
  guessTally: GuessTally;
  gameStreak: GameStreak;
}) {
  const rounds = gameTally.rounds + guessTally.rounds;
  return (
    <div className="bg-card relative mt-5 w-full overflow-hidden rounded-xl border px-4 py-3">
      <span
        aria-hidden
        className="animate-chat-shimmer-sweep motion-reduce:animate-none pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0"
      />
      <p className="text-sm font-semibold">
        <span aria-hidden>🎲</span> You played <TickUp value={rounds} />{" "}
        {rounds === 1 ? "round" : "rounds"} together
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
  /** The partner's mutually-revealed handle, shown for copying during the
   *  post-end grace window and gone forever after. Never on the receipt. */
  revealedHandle?: string;
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

  return (
    <section
      aria-label="Chat ended"
      className="flex flex-1 flex-col items-center overflow-y-auto px-6 py-10 text-center"
    >
      <div className="my-auto flex w-full max-w-sm flex-col items-center">
        <div
          aria-hidden
          className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-full"
        >
          <MessageCircleOffIcon className="size-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">{title}</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          The conversation is gone. Nothing was saved.
        </p>

        {gameTally &&
          guessTally &&
          gameTally.rounds + guessTally.rounds > 0 && (
            <AfterglowCard
              gameTally={gameTally}
              guessTally={guessTally}
              gameStreak={gameStreak ?? { current: 0, best: 0 }}
            />
          )}
        {revealedHandle && (
          <div className="bg-card mt-5 w-full rounded-xl border p-4">
            <p className="text-sm font-medium">
              <span aria-hidden>💞</span> You stayed connected
            </p>
            <div className="bg-muted/60 mt-3 flex items-center justify-between gap-2 rounded-lg py-1.5 pr-1.5 pl-3">
              <span className="truncate text-sm font-semibold">
                {revealedHandle}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() =>
                  navigator.clipboard
                    ?.writeText(revealedHandle)
                    .then(() => toast("Copied. Save it somewhere safe."))
                    .catch(() => toast("Couldn't copy. Select it instead."))
                }
              >
                <CopyIcon /> Copy
              </Button>
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              Copy it now. This screen won't come back.
            </p>
          </div>
        )}

        <div className="mt-6 flex w-full flex-col gap-2">
          <Button className="w-full" onClick={onFindNew}>
            Find someone new
            <ArrowRightIcon />
          </Button>
          {stats && (
            <ShareCardAction
              label="Share the vibe"
              filename="umamin-chat-receipt.png"
              build={async () =>
                buildReceiptCard(stats, await loadCardAssets())
              }
              trigger={(open) => (
                <Button variant="outline" className="w-full" onClick={open}>
                  <Share2Icon />
                  Share the vibe
                </Button>
              )}
            />
          )}
          <Button
            variant="ghost"
            className="text-muted-foreground w-full"
            onClick={onBackToLobby}
          >
            Back to lobby
          </Button>
        </div>

        <ClientOnlyAdContainer placement="chat_ended" className="mt-8 w-full" />
      </div>
    </section>
  );
}
