import { Button } from "@umamin/ui/components/button";
import { ArrowRight } from "lucide-react";
import type { EndedReason } from "../../lib/session/types";
import { AdContainer } from "../ads/ad-container";

// Normal document flow (not an overlay) so the ad below is AdSense-policy-compliant.
export function EndedView({
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
    <section
      aria-label="Chat ended"
      className="flex flex-1 flex-col items-center justify-center p-6 text-center"
    >
      <div aria-hidden className="mb-3 text-4xl">
        👋
      </div>
      <h2 className="font-display text-lg font-bold">{title}</h2>
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
      <AdContainer placement="ended" className="mt-8 max-w-sm" />
    </section>
  );
}
