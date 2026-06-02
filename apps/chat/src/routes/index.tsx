import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@umamin/ui/components/button";
import { ArrowRight } from "lucide-react";
import { IdentityCard } from "../components/lobby/identity-card";
import { InterestPicker } from "../components/lobby/interest-picker";
import { AppShell } from "../components/shell/app-shell";
import { ThemeToggle } from "../components/theme-toggle";
import { useIdentityDraft } from "../lib/identity/use-identity-draft";
import { useChatSession } from "../lib/session/chat-context";

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
      <span className="text-sm font-bold">
        umamin<span className="text-primary">·chat</span>
      </span>
      <IdentityCard
        alias={draft.alias}
        avatarSeed={draft.avatarSeed}
        maxAlias={draft.maxAlias}
        onAliasChange={draft.setAlias}
        onShuffle={draft.shuffle}
      />
      <div className="mt-auto">
        <ThemeToggle />
      </div>
    </div>
  );

  return (
    <AppShell rail={rail}>
      <div className="mx-auto flex h-full max-w-xl flex-col overflow-y-auto p-6 sm:p-8">
        <span className="border-primary/30 bg-primary/10 text-primary inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs">
          <span className="bg-primary size-1.5 animate-pulse rounded-full" />
          1,248 chatting now
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
          Talk to someone new.
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Pick what you're into — we'll match you with a stranger who shares it.
          No history, nothing saved.
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
      </div>
    </AppShell>
  );
}
