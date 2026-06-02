import { Button } from "@umamin/ui/components/button";
import { ArrowRight } from "lucide-react";
import { useEffect, useId, useRef } from "react";
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

  const titleId = useId();
  const findNewRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    findNewRef.current?.focus();
  }, []);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="bg-background/80 absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm"
    >
      <div aria-hidden className="mb-3 text-4xl">
        👋
      </div>
      <h2 id={titleId} className="text-lg font-bold">
        {title}
      </h2>
      <p className="text-muted-foreground mt-1 mb-5 max-w-xs text-sm">
        Poof — that conversation's gone. Nothing was saved.
      </p>
      <Button ref={findNewRef} className="rounded-full" onClick={onFindNew}>
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
