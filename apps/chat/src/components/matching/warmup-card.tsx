import { useState } from "react";
import { GAME_DECKS } from "../../../convex/decks";

const CARDS = GAME_DECKS["this-or-that"];

/** Solo this-or-that while the radar searches — wait-time as warm-up. Picks
 *  live in component state only; the latest one is offered upstream as an
 *  ice-breaker ("Coffee or tea? (I'm team coffee)") once a match lands. */
export function WarmupCard({ onPick }: { onPick?: (prompt: string) => void }) {
  const [index, setIndex] = useState(() =>
    Math.floor(Math.random() * CARDS.length),
  );
  const [picked, setPicked] = useState(0);
  const card = CARDS[index];

  function pick(side: "A" | "B") {
    const chosen = side === "A" ? card.optionA : card.optionB;
    onPick?.(`${card.optionA} or ${card.optionB}? (I'm team ${chosen})`);
    setPicked((n) => n + 1);
    setIndex((i) => (i + 1) % CARDS.length);
  }

  return (
    <section
      aria-label="Warm-up question"
      className="bg-card mt-6 w-full max-w-xs rounded-xl border p-3"
    >
      <p className="text-muted-foreground text-[11px] font-medium">
        While you wait — pick a side
      </p>
      {/* Keyed per card so each new one pops in. */}
      <div
        key={card.id}
        className="animate-pop-in motion-reduce:animate-none mt-2 grid grid-cols-2 gap-2"
      >
        <button
          type="button"
          onClick={() => pick("A")}
          className="hover:border-primary/50 focus-visible:ring-ring/50 min-h-12 rounded-xl border px-3 py-2 text-sm font-medium transition-transform outline-none focus-visible:ring-[3px] active:scale-95"
        >
          {card.optionA}
        </button>
        <button
          type="button"
          onClick={() => pick("B")}
          className="hover:border-primary/50 focus-visible:ring-ring/50 min-h-12 rounded-xl border px-3 py-2 text-sm font-medium transition-transform outline-none focus-visible:ring-[3px] active:scale-95"
        >
          {card.optionB}
        </button>
      </div>
      {picked > 0 && (
        <p className="text-muted-foreground mt-2 text-[11px] tabular-nums">
          {picked} picked ✦ your last pick becomes an opener
        </p>
      )}
    </section>
  );
}
