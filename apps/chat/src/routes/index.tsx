import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@umamin/ui/components/button";
import { ArrowRight, Share2 } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { MAX_INVITE_CODE_LEN } from "../../convex/constants";
import { AdContainer } from "../components/ads/ad-container";
import { Attribution } from "../components/attribution";
import { IdentityCard } from "../components/lobby/identity-card";
import { InterestPicker } from "../components/lobby/interest-picker";
import { InviteBanner } from "../components/lobby/invite-banner";
import { PlatformPromo } from "../components/promo/platform-promo";
import { ShareCardAction } from "../components/share/share-card-action";
import { AppShell, Wordmark } from "../components/shell/app-shell";
import { ThemeToggle } from "../components/theme-toggle";
import { useIdentityDraft } from "../lib/identity/use-identity-draft";
import { getInviteCode } from "../lib/invite/invite-code";
import { useChatSession } from "../lib/session/chat-context";
import { loadCardAssets } from "../lib/share-card/assets";
import { buildInviteCard } from "../lib/share-card/invite-template";
import { INVITE_BASE_URL } from "../lib/share-card/theme";

const maintenanceMode = import.meta.env.VITE_MAINTENANCE === "true";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { join?: string } => {
    const join =
      typeof search.join === "string"
        ? search.join.trim().slice(0, MAX_INVITE_CODE_LEN)
        : "";
    return join ? { join } : {};
  },
  component: Lobby,
});

function Lobby() {
  const navigate = useNavigate();
  const { join } = Route.useSearch();
  const { snapshot, findMatch } = useChatSession();
  const draft = useIdentityDraft();

  // A live session outranks the lobby: an accidental tab close (or reload)
  // within the away grace should drop the user straight back into their chat
  // (or their spot in the queue), not strand them here while a partner waits.
  useEffect(() => {
    if (snapshot.phase === "active" || snapshot.phase === "matching") {
      navigate({ to: "/chat" });
    }
  }, [snapshot.phase, navigate]);

  function start() {
    findMatch(
      {
        alias: draft.alias.trim() || "Anonymous",
        avatarSeed: draft.avatarSeed,
        interests: draft.interests,
      },
      join
        ? {
            joinCode: join,
            onInviteMiss: () =>
              toast("They're not around — finding you someone new"),
          }
        : undefined,
    );
    navigate({ to: "/chat" });
  }

  const rail = (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <Wordmark />
        <ThemeToggle />
      </div>
      <IdentityCard
        alias={draft.alias}
        avatarSeed={draft.avatarSeed}
        maxAlias={draft.maxAlias}
        onAliasChange={draft.setAlias}
        onShuffle={draft.shuffle}
      />
      <div className="mt-auto flex flex-col gap-3">
        <PlatformPromo />
        <Attribution />
      </div>
    </div>
  );

  return (
    <AppShell rail={rail}>
      <div className="mx-auto flex h-full max-w-xl flex-col overflow-y-auto p-6 sm:p-8">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Anonymous conversations with{" "}
          <span className="text-primary">unexpected people.</span>
        </h1>
        {maintenanceMode ? (
          <div className="bg-card my-auto rounded-xl border p-6 text-center">
            <div aria-hidden className="mb-3 text-4xl">
              🛠️
            </div>
            <h2 className="font-display text-lg font-bold">
              Under maintenance
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Umamin Chat is taking a short break while we sort things out.
              Please check back soon — thanks for your patience.
            </p>
          </div>
        ) : (
          <>
            <p className="text-muted-foreground mt-1 text-sm">
              Pick what you're into — we'll match you with a stranger who shares
              it. No history, nothing saved.
            </p>

            {join && (
              <InviteBanner
                onDismiss={() =>
                  navigate({ to: "/", search: {}, replace: true })
                }
              />
            )}

            <p className="text-muted-foreground mt-6 mb-2 text-[11px] font-medium tracking-wide uppercase">
              Your interests
            </p>
            <InterestPicker
              selected={draft.interests}
              onToggle={draft.toggleInterest}
            />

            <div className="mt-auto pt-8">
              <Button
                size="lg"
                className="h-12 w-full rounded-full text-base"
                onClick={start}
              >
                Find someone who gets you
                <ArrowRight />
              </Button>
              <p className="text-muted-foreground mt-2 text-center text-[11px]">
                {draft.interests.length > 0
                  ? `${draft.interests.length} selected · matches on at least one`
                  : "no interests picked · we'll match you with anyone"}
              </p>
              <div className="mt-4 flex justify-center">
                <ShareCardAction
                  label="Share your card"
                  title="Your invite card"
                  description="Post it to your story, then copy your link and add it with a link sticker where the dashed guide shows (the guide isn't on the shared image). Anyone who taps it lands on you while you're searching."
                  filename="umamin-chat-invite.png"
                  copyUrl={`${INVITE_BASE_URL}/?join=${getInviteCode()}`}
                  build={async () =>
                    buildInviteCard(
                      {
                        alias: draft.alias.trim() || "Anonymous",
                        avatarSeed: draft.avatarSeed,
                        interests: draft.interests,
                      },
                      await loadCardAssets(),
                    )
                  }
                  trigger={(open) => (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={open}
                      className="text-muted-foreground rounded-full"
                    >
                      <Share2 className="size-3.5" />
                      Share your card
                    </Button>
                  )}
                />
              </div>
            </div>

            <AdContainer placement="lobby" className="mt-6" />
          </>
        )}
      </div>
    </AppShell>
  );
}
