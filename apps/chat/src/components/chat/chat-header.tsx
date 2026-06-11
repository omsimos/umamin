import { Button } from "@umamin/ui/components/button";
import { cn } from "@umamin/ui/lib/utils";
import { Heart } from "lucide-react";
import { interestById } from "../../lib/content";
import type { GameTally, Partner } from "../../lib/session/types";
import { SeedAvatar } from "../seed-avatar";

export function ChatHeader({
  partner,
  stayConnectedActive,
  onStayConnected,
  gameTally,
}: {
  partner: Partner;
  stayConnectedActive: boolean;
  onStayConnected: () => void;
  gameTally?: GameTally;
}) {
  const shared = interestById(partner.sharedInterests[0]);
  const status =
    partner.status === "typing"
      ? "typing…"
      : partner.status === "away"
        ? "away"
        : partner.status === "left"
          ? "left"
          : "online";
  const tone =
    partner.status === "left"
      ? "text-muted-foreground"
      : partner.status === "away"
        ? "text-amber-600 dark:text-amber-500"
        : "text-emerald-600";

  return (
    <header className="flex items-center gap-3 border-b px-4 py-3">
      <SeedAvatar
        seed={partner.avatarSeed}
        alias={partner.alias}
        className="size-8"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{partner.alias}</p>
        <p className={cn("text-[11px]", tone)}>
          <span aria-hidden>●</span> {status}
        </p>
      </div>
      {shared && (
        <span className="bg-muted text-muted-foreground ml-1 rounded-full px-2 py-0.5 text-[10px]">
          <span aria-hidden>{shared.emoji}</span> {shared.label}
        </span>
      )}
      {gameTally && gameTally.rounds > 0 && (
        <span className="bg-muted text-muted-foreground ml-1 rounded-full px-2 py-0.5 text-[10px] tabular-nums">
          <span aria-hidden>
            🎯 {gameTally.matched}/{gameTally.rounds}
          </span>
          <span className="sr-only">
            Game score: {gameTally.matched} of {gameTally.rounds} answers
            matched
          </span>
        </span>
      )}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Stay connected"
        className={cn(
          "ml-auto rounded-full",
          stayConnectedActive && "text-primary",
        )}
        onClick={onStayConnected}
      >
        <Heart className={cn(stayConnectedActive && "fill-current")} />
      </Button>
    </header>
  );
}
