import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@umamin/ui/components/button";
import { ArrowRight } from "lucide-react";
import { AdContainer } from "../components/ads/ad-container";
import { Attribution } from "../components/attribution";
import { IdentityCard } from "../components/lobby/identity-card";
import { InterestPicker } from "../components/lobby/interest-picker";
import { PlatformPromo } from "../components/promo/platform-promo";
import { AppShell, Wordmark } from "../components/shell/app-shell";
import { ThemeToggle } from "../components/theme-toggle";
import { useIdentityDraft } from "../lib/identity/use-identity-draft";
import { useChatSession } from "../lib/session/chat-context";

const maintenanceMode = import.meta.env.VITE_MAINTENANCE === "true";

export const Route = createFileRoute("/")({
  component: Lobby,
});

function Lobby() {
  const navigate = useNavigate();
  const { findMatch } = useChatSession();
  const draft = useIdentityDraft();

  function start() {
    findMatch({
      alias: draft.alias.trim() || "Anonymous",
      avatarSeed: draft.avatarSeed,
      interests: draft.interests,
    });
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
            </div>

            <AdContainer placement="lobby" className="mt-6" />
          </>
        )}
      </div>
    </AppShell>
  );
}
