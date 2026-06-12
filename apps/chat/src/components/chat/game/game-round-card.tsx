import { Button } from "@umamin/ui/components/button";
import { cn } from "@umamin/ui/lib/utils";
import { X } from "lucide-react";
import { cardById, DECK_META } from "../../../../convex/decks";
import type { GamePick, GameRound } from "../../../lib/session/types";

function OptionButton({
  label,
  pick,
  round,
  partnerAlias,
  onAnswer,
}: {
  label: string;
  pick: GamePick;
  round: GameRound;
  partnerAlias: string;
  onAnswer: (pick: GamePick) => void;
}) {
  const revealed = round.partnerPick !== undefined && round.selfPick !== null;
  const pickedBySelf = round.selfPick === pick;
  const pickedByPartner = round.partnerPick === pick;
  const answered = round.selfPick !== null;

  return (
    <button
      type="button"
      disabled={answered}
      onClick={() => onAnswer(pick)}
      aria-pressed={pickedBySelf}
      className={cn(
        "relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border px-3 py-2.5 text-center text-sm font-medium",
        "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
        "transition-[transform,border-color] not-disabled:active:scale-95",
        pickedBySelf
          ? "border-primary bg-primary/10"
          : answered
            ? "opacity-60"
            : "hover:border-primary/50",
      )}
    >
      {label}
      {revealed && (pickedBySelf || pickedByPartner) && (
        <span className="flex flex-wrap items-center justify-center gap-1">
          {pickedBySelf && (
            <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-[10px] font-semibold">
              You
            </span>
          )}
          {pickedByPartner && (
            <span className="bg-muted text-muted-foreground max-w-24 truncate rounded-full px-2 py-0.5 text-[10px] font-semibold">
              {partnerAlias}
            </span>
          )}
        </span>
      )}
    </button>
  );
}

/** Result line, viewer-relative. In guess mode the success copy depends on
 *  who was the mind reader — the dealer's pick was the truth. */
function resultLine(round: GameRound, partnerAlias: string, matched: boolean) {
  if (round.mode !== "guess") {
    return matched ? "⚡ It's a match!" : "Opposites attract 🤷";
  }
  if (round.dealtBy === "partner") {
    return matched
      ? "🔮 You read their mind!"
      : "Way off — they're full of surprises 😏";
  }
  return matched
    ? `🔮 ${partnerAlias} read you like a book!`
    : `${partnerAlias} guessed wrong 😏`;
}

function hintLine(round: GameRound, partnerAlias: string) {
  const guessing = round.mode === "guess" && round.dealtBy === "partner";
  if (round.selfPick !== null) {
    return round.mode === "guess" && round.dealtBy === "self"
      ? `${partnerAlias} is reading your mind…`
      : `Waiting for ${partnerAlias}…`;
  }
  if (round.partnerAnswered) {
    return guessing
      ? `${partnerAlias} answered — what did they pick? 🔮`
      : `${partnerAlias} picked — your turn 👀`;
  }
  if (guessing) return `Trust your gut — what did ${partnerAlias} pick? 🔮`;
  if (round.mode === "guess") {
    return `Answer honestly — ${partnerAlias} is guessing your pick`;
  }
  return "Pick one — answers reveal together";
}

export function GameRoundCard({
  round,
  partnerAlias,
  streak = 0,
  onAnswer,
  onDismiss,
  onPlayAgain,
}: {
  round: GameRound;
  partnerAlias: string;
  /** Current consecutive-success streak (incl. this round once revealed). */
  streak?: number;
  onAnswer: (pick: GamePick) => void;
  onDismiss: () => void;
  /** Deals another random card from the same deck (and mode). */
  onPlayAgain: () => void;
}) {
  const card = cardById(round.cardId);
  if (!card) return null;
  const meta = DECK_META[card.deck];
  const revealed = round.partnerPick !== undefined && round.selfPick !== null;
  const matched = revealed && round.selfPick === round.partnerPick;
  const guess = round.mode === "guess";

  return (
    <section
      aria-label={guess ? "Mind Reader round" : `${meta.label} round`}
      className="border-primary/30 from-primary/10 mx-4 mb-2 rounded-xl border bg-gradient-to-br to-transparent p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-muted-foreground text-[11px] font-medium">
          {guess ? (
            <>
              <span aria-hidden>🔮</span> Mind Reader · {meta.label}
            </>
          ) : (
            <>
              <span aria-hidden>{meta.emoji}</span> {meta.label}
            </>
          )}{" "}
          ·{" "}
          {round.dealtBy === "self"
            ? "dealt by you"
            : `dealt by ${partnerAlias}`}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Dismiss game"
          onClick={onDismiss}
          className="-mt-1.5 -mr-1.5 size-7 rounded-full"
        >
          <X />
        </Button>
      </div>
      {card.prompt && <p className="mt-1 text-sm font-medium">{card.prompt}</p>}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <OptionButton
          label={card.optionA}
          pick="A"
          round={round}
          partnerAlias={partnerAlias}
          onAnswer={onAnswer}
        />
        <OptionButton
          label={card.optionB}
          pick="B"
          round={round}
          partnerAlias={partnerAlias}
          onAnswer={onAnswer}
        />
      </div>
      <div className="mt-2 flex min-h-7 items-center justify-between gap-2">
        {revealed ? (
          <>
            <p className="animate-in zoom-in-95 fade-in flex items-center gap-1.5 text-sm font-semibold">
              {resultLine(round, partnerAlias, matched)}
              {matched && streak >= 2 && (
                <span className="animate-pop-in motion-reduce:animate-none bg-primary/15 text-primary inline-flex rounded-full px-2 py-0.5 text-[11px] tabular-nums">
                  <span
                    aria-hidden
                    className={cn(
                      streak >= 3 &&
                        "animate-flame-flicker motion-reduce:animate-none",
                    )}
                  >
                    🔥×{streak}
                  </span>
                  <span className="sr-only">
                    {streak} successful rounds in a row
                  </span>
                </span>
              )}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onPlayAgain}
              className="rounded-full"
            >
              Play another
            </Button>
          </>
        ) : (
          <p
            className={cn(
              "text-muted-foreground text-xs",
              round.selfPick !== null && "animate-pulse",
            )}
          >
            {hintLine(round, partnerAlias)}
          </p>
        )}
      </div>
      {/* Viewport edge pulse for a hot streak — static inset shadow, faded via
          opacity only; base opacity-0 keeps it invisible under reduced motion. */}
      {matched && streak >= 3 && (
        <div
          aria-hidden
          className="animate-streak-glow motion-reduce:animate-none shadow-primary/50 pointer-events-none fixed inset-0 z-20 opacity-0 shadow-[inset_0_0_60px_12px]"
        />
      )}
    </section>
  );
}
