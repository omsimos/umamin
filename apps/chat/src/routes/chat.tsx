import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cardById, GAME_DECKS } from "../../convex/decks";
import { ChatHeader } from "../components/chat/chat-header";
import type { ComposerMode } from "../components/chat/composer-actions";
import { ConnectionSheet } from "../components/chat/connect/connection-sheet";
import { HandleRevealOverlay } from "../components/chat/connect/handle-reveal-overlay";
import { EndedView } from "../components/chat/ended-view";
import { GameRoundCard } from "../components/chat/game/game-round-card";
import { IceBreakerBanner } from "../components/chat/ice-breaker-banner";
import { MessageComposer } from "../components/chat/message-composer";
import { MessageList } from "../components/chat/message-list";
import { SendEffectOverlay } from "../components/chat/send-effect-overlay";
import { StayConnectedCelebration } from "../components/chat/stay-connected-celebration";
import { LevelUpToast } from "../components/chat/vibe/level-up-toast";
import { VibeSheet } from "../components/chat/vibe/vibe-sheet";
import { MatchingRadar } from "../components/matching/matching-radar";
import { MatchPresence } from "../components/presence/match-presence";
import { QueueHeartbeat } from "../components/presence/queue-heartbeat";
import { AppShell, Wordmark } from "../components/shell/app-shell";
import { SessionRail } from "../components/shell/session-rail";
import { useChatSession } from "../lib/session/chat-context";
import type { ChatMessage } from "../lib/session/types";
import { useChatStats } from "../lib/share-card/use-chat-stats";
import { useSendEffects } from "../lib/use-send-effects";

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
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [vibeSheetOpen, setVibeSheetOpen] = useState(false);
  const [levelUp, setLevelUp] = useState<number | null>(null);
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
    setVibeSheetOpen(false);
    setLevelUp(null);
    setConnectOpen(false);
    setRevealOverlayOpen(false);
  }, [snapshot.matchId]);

  // Celebrate level TRANSITIONS only: the seen-level ref is seeded per match
  // identity, so a reload (or rejoining mid-match) starts at the current level
  // and doesn't re-celebrate. No server dedup state for a cosmetic one-shot.
  const seenLevel = useRef({ matchId: "", level: 1 });
  const vibeLevel = snapshot.vibe.level;
  useEffect(() => {
    if (!snapshot.matchId) return;
    if (seenLevel.current.matchId !== snapshot.matchId) {
      seenLevel.current = { matchId: snapshot.matchId, level: vibeLevel };
      return;
    }
    if (vibeLevel > seenLevel.current.level) {
      seenLevel.current.level = vibeLevel;
      if (phase === "active") setLevelUp(vibeLevel);
    }
  }, [snapshot.matchId, vibeLevel, phase]);

  // Reveal moments, same seeded-transition pattern: the asymmetric tease when
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

  function playAnother() {
    const round = snapshot.game;
    const deck = cardById(round?.cardId ?? "")?.deck;
    if (!round || !deck) return;
    const cards = GAME_DECKS[deck];
    dealCard(
      cards[Math.floor(Math.random() * cards.length)].id,
      round.mode === "guess" ? "guess" : undefined,
    );
  }

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
              onWarmupPick={setWarmupPrompt}
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
              vibe={snapshot.vibe}
              gameStreak={snapshot.gameStreak}
              stayConnectedActive={stayConnected.self}
              mutual={mutual}
              revealTease={reveal.partner.submitted && !bothRevealed}
              onStayConnected={signalStayConnected}
              onOpenConnect={() => setConnectOpen(true)}
              onShowVibe={() => setVibeSheetOpen(true)}
            />
            <MessageList
              messages={messages}
              partnerStatus={partner.status}
              onReact={react}
              onReply={setReplyTarget}
              onViewWhisper={viewWhisper}
              vibeLevel={vibeLevel}
              self={{ alias: self.alias, avatarSeed: self.avatarSeed }}
              partner={{
                alias: partner.alias,
                avatarSeed: partner.avatarSeed,
              }}
              header={
                showIceBreaker ? (
                  <IceBreakerBanner
                    sharedInterests={partner.sharedInterests}
                    extraPrompt={warmupPrompt}
                    onPrompt={(text) => {
                      send(text);
                      setIceBreakerDismissed(true);
                    }}
                    onDismiss={() => setIceBreakerDismissed(true)}
                  />
                ) : undefined
              }
            />
            {snapshot.game && (
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
              />
            )}
            <MessageComposer
              onSend={sendWithMode}
              onTyping={setTyping}
              onDealCard={dealCard}
              vibeLevel={vibeLevel}
              onShowVibe={() => setVibeSheetOpen(true)}
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
            vibe={snapshot.vibe}
            gameTally={snapshot.gameTally}
            guessTally={snapshot.guessTally}
            gameStreak={snapshot.gameStreak}
            onFindNew={() => findMatch(self)}
            onBackToLobby={() => navigate({ to: "/" })}
          />
        )}

        {phase === "active" && activeEffect && (
          <SendEffectOverlay effect={activeEffect} onDone={clearEffect} />
        )}

        {phase === "active" && partner && (
          <VibeSheet
            open={vibeSheetOpen}
            onOpenChange={setVibeSheetOpen}
            vibe={snapshot.vibe}
            gameTally={snapshot.gameTally}
            guessTally={snapshot.guessTally}
            gameStreak={snapshot.gameStreak}
            self={{ alias: self.alias, avatarSeed: self.avatarSeed }}
            partner={{ alias: partner.alias, avatarSeed: partner.avatarSeed }}
          />
        )}

        {phase === "active" && levelUp !== null && (
          <LevelUpToast
            key={levelUp}
            level={levelUp}
            onDone={() => setLevelUp(null)}
            onShowVibe={() => setVibeSheetOpen(true)}
          />
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
      </div>
    </AppShell>
  );
}
