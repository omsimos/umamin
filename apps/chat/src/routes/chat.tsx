import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChatHeader } from "../components/chat/chat-header";
import { EndedView } from "../components/chat/ended-view";
import { IceBreakerBanner } from "../components/chat/ice-breaker-banner";
import { MessageComposer } from "../components/chat/message-composer";
import { MessageList } from "../components/chat/message-list";
import { StayConnectedCelebration } from "../components/chat/stay-connected-celebration";
import { MatchingRadar } from "../components/matching/matching-radar";
import { MatchPresence } from "../components/presence/match-presence";
import { QueueHeartbeat } from "../components/presence/queue-heartbeat";
import { AppShell, Wordmark } from "../components/shell/app-shell";
import { SessionRail } from "../components/shell/session-rail";
import { useChatSession } from "../lib/session/chat-context";

// Presence heartbeats only flow against a real Convex backend; on the mock
// there's no ConvexProvider, so MatchPresence (which calls Convex hooks) stays
// unmounted.
const presenceEnabled = Boolean(import.meta.env.VITE_CONVEX_URL);

export const Route = createFileRoute("/chat")({
  component: Session,
});

// Not exported: keeping the route component inline (referenced only by Route)
// lets TanStack Router's autoCodeSplitting pull it into its own chunk.
function Session() {
  const navigate = useNavigate();
  const {
    snapshot,
    send,
    react,
    setTyping,
    signalStayConnected,
    leave,
    findMatch,
  } = useChatSession();
  const { phase, self, partner, messages, stayConnected } = snapshot;

  // Bounce to the lobby only once we KNOW there's no live session. "loading"
  // (the snapshot still resolving on a fresh reload) must NOT bounce. The
  // transport holds an optimistic "matching" across a rematch, so a transient
  // idle never reaches here during a valid rematch — and a *failed* rematch
  // resolves to idle and correctly bounces back to the lobby.
  useEffect(() => {
    if (phase === "loading") return;
    if (phase === "idle") navigate({ to: "/" });
  }, [phase, navigate]);

  const [iceBreakerDismissed, setIceBreakerDismissed] = useState(false);
  const [celebrationDismissed, setCelebrationDismissed] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on match identity
  useEffect(() => {
    setIceBreakerDismissed(false);
    setCelebrationDismissed(false);
  }, [snapshot.matchId]);

  function newMatch() {
    leave();
    findMatch(self);
    toast("Finding someone new…");
  }

  function endChat() {
    leave("self-ended");
  }

  const rail =
    phase === "active" ? (
      <SessionRail
        selfAlias={self.alias}
        selfSeed={self.avatarSeed}
        onNewMatch={newMatch}
        onEndChat={endChat}
      />
    ) : (
      <Wordmark />
    );

  const showIceBreaker =
    !iceBreakerDismissed &&
    messages.filter((m) => m.author === "self").length === 0;
  const mutual = stayConnected.self && stayConnected.partner;

  return (
    <AppShell rail={rail}>
      <div className="relative flex h-full flex-col">
        {phase === "loading" && (
          <div className="flex flex-1 items-center justify-center">
            <Loader2
              aria-label="Loading"
              className="text-muted-foreground size-6 animate-spin"
            />
          </div>
        )}

        {phase === "matching" && (
          <>
            {presenceEnabled && <QueueHeartbeat />}
            <MatchingRadar
              self={{ alias: self.alias, avatarSeed: self.avatarSeed }}
              interests={self.interests}
              onCancel={() => {
                leave();
                navigate({ to: "/" });
              }}
            />
          </>
        )}

        {phase === "active" && partner && (
          <>
            {presenceEnabled && snapshot.matchId && (
              // Keyed so a match change always remounts with a fresh presence
              // session — the room's per-tab id must never span two matches.
              <MatchPresence
                key={snapshot.matchId}
                matchId={snapshot.matchId}
              />
            )}
            <ChatHeader
              partner={partner}
              stayConnectedActive={stayConnected.self}
              onStayConnected={signalStayConnected}
            />
            <MessageList
              messages={messages}
              partnerStatus={partner.status}
              onReact={react}
              header={
                showIceBreaker ? (
                  <IceBreakerBanner
                    sharedInterests={partner.sharedInterests}
                    onPrompt={(text) => {
                      send(text);
                      setIceBreakerDismissed(true);
                    }}
                    onDismiss={() => setIceBreakerDismissed(true)}
                  />
                ) : undefined
              }
            />
            <MessageComposer onSend={send} onTyping={setTyping} />
          </>
        )}

        {phase === "ended" && (
          <EndedView
            reason={snapshot.endedReason}
            partnerAlias={partner?.alias}
            onFindNew={() => findMatch(self)}
            onBackToLobby={() => navigate({ to: "/" })}
          />
        )}

        {phase === "active" && mutual && !celebrationDismissed && partner && (
          <StayConnectedCelebration
            selfAlias={self.alias}
            selfSeed={self.avatarSeed}
            partnerAlias={partner.alias}
            partnerSeed={partner.avatarSeed}
            onContinue={() => setCelebrationDismissed(true)}
          />
        )}
      </div>
    </AppShell>
  );
}
