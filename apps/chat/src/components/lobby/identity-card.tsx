import { Button } from "@umamin/ui/components/button";
import { Input } from "@umamin/ui/components/input";
import { Shuffle } from "lucide-react";
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

  // Pure whimsy: each poke bounces the avatar; every third one shuffles the
  // seed (a discoverable shortcut to the Shuffle button).
  function poke() {
    const next = pokes + 1;
    setPokes(next);
    if (next % 3 === 0) onShuffle();
  }

  return (
    <div className="bg-card flex flex-col gap-3 rounded-xl border p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Poke your avatar"
          onClick={poke}
          className="focus-visible:ring-ring/50 rounded-full outline-none focus-visible:ring-[3px]"
        >
          <span
            key={pokes}
            className={
              pokes > 0
                ? "animate-pop-in motion-reduce:animate-none inline-flex"
                : "inline-flex"
            }
          >
            <SeedAvatar seed={avatarSeed} alias={alias} className="size-9" />
          </span>
        </button>
        <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
          you'll appear as
        </span>
      </div>
      <Input
        value={alias}
        maxLength={maxAlias}
        aria-label="Your alias"
        placeholder="Pick a name"
        onChange={(e) => onAliasChange(e.target.value)}
      />
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-[10px]">
          {alias.length} / {maxAlias}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={onShuffle}
        >
          <Shuffle />
          Shuffle
        </Button>
      </div>
    </div>
  );
}
