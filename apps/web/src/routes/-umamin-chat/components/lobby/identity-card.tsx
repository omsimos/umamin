import { Button } from "@umamin/ui/components/button";
import { Input } from "@umamin/ui/components/input";
import { ShuffleIcon } from "lucide-react";
import { useState } from "react";
import { SeedAvatar } from "../seed-avatar";

export function IdentityCard({
  alias,
  avatarSeed,
  maxAlias,
  onAliasChange,
  onShuffle,
}: {
  alias: string;
  avatarSeed: string;
  maxAlias: number;
  onAliasChange: (value: string) => void;
  onShuffle: () => void;
}) {
  const [pokes, setPokes] = useState(0);

  // Pure whimsy: each poke bounces the avatar, and every third one shuffles
  // the seed (a discoverable shortcut to the Shuffle button).
  function poke() {
    const next = pokes + 1;
    setPokes(next);
    if (next % 3 === 0) onShuffle();
  }

  return (
    <div className="bg-card rounded-xl border p-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Poke your avatar"
          onClick={poke}
          className="focus-visible:ring-ring/50 shrink-0 rounded-full outline-none focus-visible:ring-[3px]"
        >
          <span
            key={pokes}
            className={
              pokes > 0
                ? "animate-chat-pop-in inline-flex motion-reduce:animate-none"
                : "inline-flex"
            }
          >
            <SeedAvatar seed={avatarSeed} alias={alias} className="size-11" />
          </span>
        </button>
        <Input
          value={alias}
          maxLength={maxAlias}
          aria-label="Your alias"
          placeholder="Pick a name"
          onChange={(e) => onAliasChange(e.target.value)}
          className="h-10 min-w-0 flex-1"
        />
        <Button
          variant="outline"
          size="icon"
          aria-label="Shuffle"
          className="size-10 shrink-0"
          onClick={onShuffle}
        >
          <ShuffleIcon />
        </Button>
      </div>
      <div className="text-muted-foreground mt-2.5 flex items-center justify-between text-xs">
        <span>This is how you'll appear. No account needed.</span>
        <span className="tabular-nums">
          {alias.length}/{maxAlias}
        </span>
      </div>
    </div>
  );
}
