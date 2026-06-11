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

export function GameRoundCard({
  round,
  partnerAlias,
  onAnswer,
  onDismiss,
  onPlayAgain,
}: {
  round: GameRound;
  partnerAlias: string;
  onAnswer: (pick: GamePick) => void;
  onDismiss: () => void;
  /** Deals another random card from the same deck. */
  onPlayAgain: () => void;
}) {
  const card = cardById(round.cardId);
  if (!card) return null;
  const meta = DECK_META[card.deck];
  const revealed = round.partnerPick !== undefined && round.selfPick !== null;
  const matched = revealed && round.selfPick === round.partnerPick;

  return (
    <section
      aria-label={`${meta.label} round`}
      className="border-primary/30 from-primary/10 mx-4 mb-2 rounded-xl border bg-gradient-to-br to-transparent p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-muted-foreground text-[11px] font-medium">
          <span aria-hidden>{meta.emoji}</span> {meta.label} ·{" "}
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
            <p className="animate-in zoom-in-95 fade-in text-sm font-semibold">
              {matched ? "⚡ It's a match!" : "Opposites attract 🤷"}
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
        ) : round.selfPick !== null ? (
          <p className="text-muted-foreground animate-pulse text-xs">
            Waiting for {partnerAlias}…
          </p>
        ) : round.partnerAnswered ? (
          <p className="text-muted-foreground text-xs">
            {partnerAlias} picked — your turn 👀
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">
            Pick one — answers reveal together
          </p>
        )}
      </div>
    </section>
  );
}
