import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChatHeader } from "../components/chat/chat-header";
import { EndedOverlay } from "../components/chat/ended-overlay";
import { IceBreakerBanner } from "../components/chat/ice-breaker-banner";
import { MessageComposer } from "../components/chat/message-composer";
import { MessageList } from "../components/chat/message-list";
import { StayConnectedCelebration } from "../components/chat/stay-connected-celebration";
import { MatchingRadar } from "../components/matching/matching-radar";
import { MatchPresence } from "../components/presence/match-presence";
import { AppShell, Wordmark } from "../components/shell/app-shell";
import { SessionRail } from "../components/shell/session-rail";
import { useChatSession } from "../lib/session/chat-context";
import { getSessionId } from "../lib/session/session-id";

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
  // Stable for the session; avoid a localStorage read on every render.
  const sessionId = useMemo(() => getSessionId(), []);

  // A rematch fires leave()+findMatch() as two separate mutations; the snapshot
  // can momentarily read "idle" between them. Suppress the lobby bounce while a
  // rematch is in flight (cleared once the phase leaves "idle").
  const rematchingRef = useRef(false);

  // Direct navigation / refresh with no live session -> back to lobby.
  useEffect(() => {
    if (phase !== "idle") {
      rematchingRef.current = false;
      return;
    }
    if (rematchingRef.current) return;
    navigate({ to: "/" });
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
    rematchingRef.current = true;
    leave();
    findMatch(self);
    toast("Finding someone new…");
  }

  function endChat() {
    leave("self-ended");
  }

  function report() {
    rematchingRef.current = true;
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
            {presenceEnabled && snapshot.matchId && (
              <MatchPresence matchId={snapshot.matchId} sessionId={sessionId} />
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
