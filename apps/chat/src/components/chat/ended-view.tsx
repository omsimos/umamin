import { Button } from "@umamin/ui/components/button";
import { ArrowRight } from "lucide-react";
import type { EndedReason } from "../../lib/session/types";
import { loadCardAssets } from "../../lib/share-card/assets";
import { buildReceiptCard } from "../../lib/share-card/receipt-template";
import type { ChatReceiptStats } from "../../lib/share-card/types";
import { AdContainer } from "../ads/ad-container";
import { ShareCardAction } from "../share/share-card-action";

// Normal document flow (not an overlay) so the ad below is AdSense-policy-compliant.
export function EndedView({
  reason,
  partnerAlias,
  stats,
  onFindNew,
  onBackToLobby,
}: {
  reason: EndedReason | undefined;
  partnerAlias: string | undefined;
  /** Frozen receipt stats; null hides the share button (e.g. partner unknown). */
  stats?: ChatReceiptStats | null;
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
      {stats && (
        <div className="mt-2">
          <ShareCardAction
            label="Share the vibe"
            filename="umamin-chat-receipt.png"
            build={async () => buildReceiptCard(stats, await loadCardAssets())}
          />
        </div>
      )}
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
