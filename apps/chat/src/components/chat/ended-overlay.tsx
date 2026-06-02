import { Button } from "@umamin/ui/components/button";
import { ArrowRight } from "lucide-react";
import type { EndedReason } from "../../lib/session/types";

export function EndedOverlay({
  reason,
  partnerAlias,
  onFindNew,
  onBackToLobby,
}: {
  reason: EndedReason | undefined;
  partnerAlias: string | undefined;
  onFindNew: () => void;
  onBackToLobby: () => void;
}) {
  const title =
    reason === "partner-left" && partnerAlias
      ? `${partnerAlias} left`
      : "Chat ended";

  return (
    <div className="bg-background/80 absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm">
      <div className="mb-3 text-4xl">👋</div>
      <p className="text-lg font-bold">{title}</p>
      <p className="text-muted-foreground mt-1 mb-5 max-w-xs text-sm">
        Poof — that conversation's gone. Nothing was saved.
      </p>
      <Button className="rounded-full" onClick={onFindNew}>
        Find someone new
        <ArrowRight />
      </Button>
      <Button
        variant="ghost"
        className="text-muted-foreground mt-2"
        onClick={onBackToLobby}
      >
        Back to lobby
      </Button>
    </div>
  );
}
