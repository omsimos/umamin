import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChatHeader } from "../components/chat/chat-header";
import { EndedOverlay } from "../components/chat/ended-overlay";
import { IceBreakerBanner } from "../components/chat/ice-breaker-banner";
import { MessageComposer } from "../components/chat/message-composer";
import { MessageList } from "../components/chat/message-list";
import { StayConnectedCelebration } from "../components/chat/stay-connected-celebration";
import { MatchingRadar } from "../components/matching/matching-radar";
import { AppShell, Wordmark } from "../components/shell/app-shell";
import { SessionRail } from "../components/shell/session-rail";
import { useChatSession } from "../lib/session/chat-context";

export const Route = createFileRoute("/chat")({
  component: Session,
});

// Not exported: keeping the route component inline (referenced only by Route)
// lets TanStack Router's autoCodeSplitting pull it into its own chunk.
function Session() {
  const navigate = useNavigate();
  const { snapshot, send, react, signalStayConnected, leave, findMatch } =
    useChatSession();
  const { phase, self, partner, messages, stayConnected } = snapshot;

  // Direct navigation / refresh with no live session -> back to lobby.
  useEffect(() => {
    if (phase === "idle") navigate({ to: "/" });
  }, [phase, navigate]);

  const [iceBreakerDismissed, setIceBreakerDismissed] = useState(false);
  const [celebrationDismissed, setCelebrationDismissed] = useState(false);

  // Reset transient UI when a new match begins.
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

  function report() {
    leave();
    findMatch(self);
    toast.success("Reported. Finding you someone new.");
  }

  const rail =
    phase === "active" || phase === "ended" ? (
      <SessionRail
        selfAlias={self.alias}
        selfSeed={self.avatarSeed}
        onNewMatch={newMatch}
        onEndChat={endChat}
        onReport={report}
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
        {phase === "matching" && (
          <MatchingRadar
            self={{ alias: self.alias, avatarSeed: self.avatarSeed }}
            interests={self.interests}
            onCancel={() => {
              leave();
              navigate({ to: "/" });
            }}
          />
        )}

        {(phase === "active" || phase === "ended") && partner && (
          <>
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
            <MessageComposer onSend={send} />
          </>
        )}

        {phase === "ended" && (
          <EndedOverlay
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
