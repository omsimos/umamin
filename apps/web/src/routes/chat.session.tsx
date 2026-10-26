import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cardById, drawCard, type PlayChoice } from "@/lib/chat/decks";
import { visibleOnline } from "@/lib/chat/stats";
import type { ChatMessage } from "@/lib/chat/types";
import { pageSeo } from "@/lib/seo";
import { ChatHeader } from "./-umamin-chat/components/chat/chat-header";
import type { ComposerMode } from "./-umamin-chat/components/chat/composer-actions";
import { ConnectionSheet } from "./-umamin-chat/components/chat/connect/connection-sheet";
import { HandleRevealOverlay } from "./-umamin-chat/components/chat/connect/handle-reveal-overlay";
import { EndedView } from "./-umamin-chat/components/chat/ended-view";
import { GameRoundCard } from "./-umamin-chat/components/chat/game/game-round-card";
import { IceBreakerBanner } from "./-umamin-chat/components/chat/ice-breaker-banner";
import { MessageComposer } from "./-umamin-chat/components/chat/message-composer";
import { MessageList } from "./-umamin-chat/components/chat/message-list";
import { SendEffectOverlay } from "./-umamin-chat/components/chat/send-effect-overlay";
import { StayConnectedCelebration } from "./-umamin-chat/components/chat/stay-connected-celebration";
import { MatchingRadar } from "./-umamin-chat/components/matching/matching-radar";
import { RouteError } from "./-umamin-chat/components/route-error";
import {
  SessionBackButton,
  SessionFrame,
  SessionHeader,
  SessionTitle,
} from "./-umamin-chat/components/shell/session-frame";
import { useChatStats } from "./-umamin-chat/lib/share-card/use-chat-stats";
import { useSendEffects } from "./-umamin-chat/lib/use-send-effects";
import { useChatSession } from "./-umamin-chat/session/chat-context";

// Full-screen: a top-level route, so neither the app navbar
// nor the menubar renders here. Client-driven: during SSR the transport doesn't exist yet and
// the snapshot is "loading", so the server only ever renders the spinner.
export const Route = createFileRoute("/chat/session")({
  head: () =>
    pageSeo({
      title: "Umamin Chat",
      description: "An anonymous one-on-one chat on Umamin.",
      robots: "noindex, nofollow",
    }),
  errorComponent: RouteError,
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
    viewWhisper,
    dealCard,
    answerCard,
    dismissGame,
    setTyping,
    signalStayConnected,
    submitRevealHandle,
    withdrawRevealHandle,
    leave,
    findMatch,
    retrySend,
  } = useChatSession();
  const { phase, self, partner, messages, stayConnected } = snapshot;

  // Bounce to the lobby only once we KNOW there's no live session. "loading"
  // (the snapshot still resolving on a fresh reload) must NOT bounce. The
  // transport holds an optimistic "matching" across a rematch, so a transient
  // idle never reaches here during a valid rematch — and a *failed* rematch
  // resolves to idle and correctly bounces back to the lobby.
  useEffect(() => {
    if (phase === "loading") return;
    if (phase === "idle") navigate({ to: "/chat", replace: true });
  }, [phase, navigate]);

  const [iceBreakerDismissed, setIceBreakerDismissed] = useState(false);
  const [celebrationDismissed, setCelebrationDismissed] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [revealOverlayOpen, setRevealOverlayOpen] = useState(false);
  const [warmupPrompt, setWarmupPrompt] = useState<string | null>(null);

  // A fresh radar clears the previous session's warm-up pick; the pick itself
  // must SURVIVE the matching→active hop (it becomes an ice-breaker chip), so
  // it is deliberately not reset on matchId.
  useEffect(() => {
    if (phase === "matching") setWarmupPrompt(null);
  }, [phase]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on match identity
  useEffect(() => {
    setIceBreakerDismissed(false);
    setCelebrationDismissed(false);
    setReplyTarget(null);
    setConnectOpen(false);
    setRevealOverlayOpen(false);
  }, [snapshot.matchId]);

  // Reveal moments, seeded per match identity so a reload doesn't replay
  // them: the asymmetric tease when
  // the partner submits first ("they left something — never WHAT"), and the
  // one-shot flip overlay when both handles land.
  const reveal = snapshot.reveal;
  const bothRevealed = Boolean(reveal.self.handle && reveal.partner.handle);
  const partnerAliasForTease = partner?.alias;
  const seenReveal = useRef({ matchId: "", teased: false, revealed: false });
  useEffect(() => {
    if (!snapshot.matchId) return;
    if (seenReveal.current.matchId !== snapshot.matchId) {
      seenReveal.current = {
        matchId: snapshot.matchId,
        teased: reveal.partner.submitted,
        revealed: bothRevealed,
      };
      return;
    }
    if (
      reveal.partner.submitted &&
      !bothRevealed &&
      !seenReveal.current.teased &&
      phase === "active" &&
      partnerAliasForTease
    ) {
      seenReveal.current.teased = true;
      toast(`${partnerAliasForTease} left something for you 👀`, {
        action: { label: "Open", onClick: () => setConnectOpen(true) },
      });
    }
    if (bothRevealed && !seenReveal.current.revealed) {
      seenReveal.current.revealed = true;
      if (phase === "active") {
        setConnectOpen(false);
        setRevealOverlayOpen(true);
      }
    }
  }, [
    snapshot.matchId,
    reveal.partner.submitted,
    bothRevealed,
    phase,
    partnerAliasForTease,
  ]);

  const { active: activeEffect, clear: clearEffect } = useSendEffects(
    messages,
    snapshot.matchId,
  );
  const receiptStats = useChatStats(snapshot);

  function sendWithMode(text: string, mode: ComposerMode) {
    send(text, {
      replyToId: replyTarget?.id,
      whisper: mode.whisper || undefined,
      effect: mode.effect,
    });
    setReplyTarget(null);
  }

  // Cards already played this match (from the result rows) plus the live
  // one, so a deal never repeats while the deck still has fresh cards.
  function play(choice: PlayChoice) {
    const played = new Set(
      messages.flatMap((m) => (m.gameResult ? [m.gameResult.cardId] : [])),
    );
    if (snapshot.game) played.add(snapshot.game.cardId);
    const card = drawCard(choice, played);
    dealCard(card.id, choice === "mind-reader" ? "guess" : undefined);
  }

  function playAnother() {
    const round = snapshot.game;
    const deck = cardById(round?.cardId ?? "")?.deck;
    if (!round || !deck) return;
    play(round.mode === "guess" ? "mind-reader" : deck);
  }

  const liveCard = snapshot.game ? cardById(snapshot.game.cardId) : undefined;
  const followUpSent = Boolean(
    liveCard && messages.some((m) => m.text === liveCard.followUp),
  );

  function newMatch() {
    leave();
    findMatch(self);
    toast("Finding someone new…");
  }

  function endChat() {
    leave("self-ended");
  }

  function cancelSearch() {
    leave();
    navigate({ to: "/chat" });
  }

  function backToLobby() {
    // Releases the held ended view, or the lobby would still see it.
    leave();
    navigate({ to: "/chat" });
  }

  const showIceBreaker =
    !iceBreakerDismissed &&
    !messages.some((m) => m.author === "self" && !m.gameResult);

  // While the live card shows a revealed round, its result row would repeat
  // it; the row takes over once the card is dismissed or re-dealt.
  const liveResultIndex =
    snapshot.game?.partnerPick !== undefined
      ? messages.findLastIndex(
          (m) => m.gameResult?.cardId === snapshot.game?.cardId,
        )
      : -1;
  const thread =
    liveResultIndex === -1
      ? messages
      : messages.filter((_, i) => i !== liveResultIndex);
  const mutual = stayConnected.self && stayConnected.partner;

  const header =
    phase === "active" && partner ? (
      <ChatHeader
        partner={partner}
        gameStreak={snapshot.gameStreak}
        stayConnectedActive={stayConnected.self}
        mutual={mutual}
        revealTease={reveal.partner.submitted && !bothRevealed}
        onStayConnected={signalStayConnected}
        onOpenConnect={() => setConnectOpen(true)}
        onNewMatch={newMatch}
        onEndChat={endChat}
      />
    ) : (
      <SessionHeader>
        <SessionBackButton
          label={phase === "matching" ? "Cancel search" : "Back to lobby"}
          onClick={phase === "matching" ? cancelSearch : backToLobby}
        />
        <SessionTitle>{phase === "ended" ? "Chat ended" : "Chat"}</SessionTitle>
      </SessionHeader>
    );

  return (
    <SessionFrame header={header}>
      {phase === "loading" && (
        <div className="flex flex-1 items-center justify-center">
          <Loader2
            aria-label="Loading"
            className="text-muted-foreground size-6 animate-spin"
          />
        </div>
      )}

      {phase === "matching" && (
        <MatchingRadar
          self={{ alias: self.alias, avatarSeed: self.avatarSeed }}
          interests={self.interests}
          online={visibleOnline(snapshot.stats)}
          onWarmupPick={setWarmupPrompt}
          onCancel={cancelSearch}
        />
      )}

      {phase === "active" && partner && (
        <>
          <MessageList
            messages={thread}
            partnerStatus={partner.status}
            onReact={react}
            onReply={setReplyTarget}
            onViewWhisper={viewWhisper}
            onRetry={retrySend}
            self={{ alias: self.alias, avatarSeed: self.avatarSeed }}
            partner={{
              alias: partner.alias,
              avatarSeed: partner.avatarSeed,
            }}
            dock={
              snapshot.game ? (
                // Keyed by round so a re-deal remounts: reveal animations stay
                // one-shot and stale option state can't leak across deals.
                <GameRoundCard
                  key={snapshot.game.cardId}
                  round={snapshot.game}
                  partnerAlias={partner.alias}
                  streak={snapshot.gameStreak.current}
                  onAnswer={(pick) => {
                    if (snapshot.game) answerCard(snapshot.game.cardId, pick);
                  }}
                  onDismiss={dismissGame}
                  onPlayAgain={playAnother}
                  onFollowUp={(text) => send(text)}
                  followUpSent={followUpSent}
                />
              ) : undefined
            }
            header={
              showIceBreaker ? (
                <IceBreakerBanner
                  sharedInterests={partner.sharedInterests}
                  extraPrompt={warmupPrompt}
                  onPrompt={(text) => {
                    send(text);
                    setIceBreakerDismissed(true);
                  }}
                  onPlay={
                    snapshot.game
                      ? undefined
                      : () => {
                          play("this-or-that");
                          setIceBreakerDismissed(true);
                        }
                  }
                  onDismiss={() => setIceBreakerDismissed(true)}
                />
              ) : undefined
            }
          />
          <MessageComposer
            onSend={sendWithMode}
            onTyping={setTyping}
            onPlay={play}
            replyTo={
              replyTarget
                ? {
                    authorLabel:
                      replyTarget.author === "self"
                        ? "yourself"
                        : partner.alias,
                    text: replyTarget.text,
                  }
                : null
            }
            onCancelReply={() => setReplyTarget(null)}
          />
        </>
      )}

      {phase === "ended" && (
        <EndedView
          reason={snapshot.endedReason}
          partnerAlias={partner?.alias}
          stats={receiptStats}
          revealedHandle={bothRevealed ? reveal.partner.handle : undefined}
          gameTally={snapshot.gameTally}
          guessTally={snapshot.guessTally}
          gameStreak={snapshot.gameStreak}
          onFindNew={() => findMatch(self)}
          onBackToLobby={backToLobby}
        />
      )}

      {phase === "active" && activeEffect && (
        <SendEffectOverlay effect={activeEffect} onDone={clearEffect} />
      )}

      {phase === "active" && mutual && !celebrationDismissed && partner && (
        <StayConnectedCelebration
          selfAlias={self.alias}
          selfSeed={self.avatarSeed}
          partnerAlias={partner.alias}
          partnerSeed={partner.avatarSeed}
          onContinue={() => setCelebrationDismissed(true)}
          onDropHandle={() => {
            setCelebrationDismissed(true);
            setConnectOpen(true);
          }}
        />
      )}

      {phase === "active" && partner && (
        <ConnectionSheet
          open={connectOpen}
          onOpenChange={setConnectOpen}
          reveal={reveal}
          self={{ alias: self.alias, avatarSeed: self.avatarSeed }}
          partner={{ alias: partner.alias, avatarSeed: partner.avatarSeed }}
          onSubmit={submitRevealHandle}
          onWithdraw={withdrawRevealHandle}
        />
      )}

      {phase === "active" && revealOverlayOpen && bothRevealed && partner && (
        <HandleRevealOverlay
          self={{ alias: self.alias, avatarSeed: self.avatarSeed }}
          partner={{
            alias: partner.alias,
            avatarSeed: partner.avatarSeed,
          }}
          selfHandle={reveal.self.handle ?? ""}
          partnerHandle={reveal.partner.handle ?? ""}
          onClose={() => setRevealOverlayOpen(false)}
        />
      )}
    </SessionFrame>
  );
}
