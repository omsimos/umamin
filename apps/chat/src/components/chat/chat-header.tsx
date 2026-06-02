import { Button } from "@umamin/ui/components/button";
import { cn } from "@umamin/ui/lib/utils";
import { Heart } from "lucide-react";
import { interestById } from "../../lib/mock/data";
import type { Partner } from "../../lib/session/types";
import { SeedAvatar } from "../seed-avatar";

export function ChatHeader({
  partner,
  stayConnectedActive,
  onStayConnected,
}: {
  partner: Partner;
  stayConnectedActive: boolean;
  onStayConnected: () => void;
}) {
  const shared = interestById(partner.sharedInterests[0]);
  const left = partner.status === "left";
  const status =
    partner.status === "typing" ? "typing…" : left ? "left" : "online";

  return (
    <header className="flex items-center gap-3 border-b px-4 py-3">
      <SeedAvatar
        seed={partner.avatarSeed}
        alias={partner.alias}
        className="size-8"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{partner.alias}</p>
        <p className="text-[11px] text-emerald-600">
          <span className={left ? "text-muted-foreground" : undefined}>●</span>{" "}
          {status}
        </p>
      </div>
      {shared && (
        <span className="bg-muted text-muted-foreground ml-1 rounded-full px-2 py-0.5 text-[10px]">
          <span aria-hidden>{shared.emoji}</span> {shared.label}
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
