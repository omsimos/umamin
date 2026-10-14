import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Badge } from "@umamin/ui/components/badge";
import { Button } from "@umamin/ui/components/button";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { ArrowRight, Share2 } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { ClientOnlyAdContainer } from "@/components/ad-container-client";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { PublicMenubar } from "@/components/public-menu-bar";
import { MAX_INVITE_CODE_LEN } from "@/lib/chat/constants";
import { absoluteUrl, pageSeo } from "@/lib/seo";
import { IdentityCard } from "./-umamin-chat/components/lobby/identity-card";
import { InterestPicker } from "./-umamin-chat/components/lobby/interest-picker";
import { InviteBanner } from "./-umamin-chat/components/lobby/invite-banner";
import { ShareCardAction } from "./-umamin-chat/components/share/share-card-action";
import { useIdentityDraft } from "./-umamin-chat/lib/identity/use-identity-draft";
import { useInviteCode } from "./-umamin-chat/lib/invite/use-invite-code";
import { loadCardAssets } from "./-umamin-chat/lib/share-card/assets";
import { buildInviteCard } from "./-umamin-chat/lib/share-card/invite-template";
import { INVITE_BASE_URL } from "./-umamin-chat/lib/share-card/theme";
import { useChatSession } from "./-umamin-chat/session/chat-context";

const TITLE = "Umamin Chat — Anonymous conversations with unexpected people";
const DESCRIPTION =
  "Get matched with a stranger who shares your interests and start a real-time, anonymous chat. No sign-up, no history — nothing is saved.";

export const Route = createFileRoute("/chat/")({
  // No default is materialized: returning one would canonicalize every bare
  // /chat to a redirect.
  validateSearch: (search: Record<string, unknown>): { join?: string } => {
    const join =
      typeof search.join === "string"
        ? search.join.trim().slice(0, MAX_INVITE_CODE_LEN)
        : "";
    return join ? { join } : {};
  },
  head: () => {
    const seo = pageSeo({
      title: TITLE,
      description: DESCRIPTION,
      path: "/chat",
      image: "/chat-opengraph.png",
    });
    return {
      ...seo,
      meta: [
        ...seo.meta,
        {
          name: "keywords",
          content:
            "anonymous chat, talk to strangers, random chat, interest-based chat, anonymous messaging, umamin",
        },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Umamin Chat",
            url: absoluteUrl("/chat"),
            applicationCategory: "CommunicationApplication",
            operatingSystem: "Web",
            browserRequirements: "Requires JavaScript",
            description: DESCRIPTION,
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            publisher: {
              "@type": "Organization",
              name: "Umamin",
              url: "https://www.umamin.link",
            },
          }),
        },
      ],
    };
  },
  component: LobbyPage,
});

function LobbyPage() {
  return (
    <>
      <Navbar />
      <PublicMenubar />
      <main className="pt-24">
        <Lobby />
      </main>
      <Footer />
    </>
  );
}

function Lobby() {
  const navigate = useNavigate();
  const { join } = Route.useSearch();
  const { snapshot, findMatch } = useChatSession();
  const draft = useIdentityDraft();
  const inviteCode = useInviteCode();

  // A live session outranks the lobby: a reload or accidental back within the
  // away grace drops the user straight into their chat (or their spot in the
  // queue), not stranded here while a partner waits.
  useEffect(() => {
    if (snapshot.phase === "active" || snapshot.phase === "matching") {
      navigate({ to: "/chat/session" });
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
    navigate({ to: "/chat/session" });
  }

  return (
    <div className="container mx-auto flex max-w-xl flex-col pb-28 lg:pb-12">
      <p className="flex items-center gap-2 text-sm font-semibold">
        Umamin Chat
        <Badge variant="secondary" className="px-1.5 text-[10px]">
          Beta
        </Badge>
      </p>
      <h1 className="font-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
        Anonymous conversations with{" "}
        <span className="text-primary">unexpected people.</span>
      </h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Pick what you're into — we'll match you with a stranger who shares it.
        No history, nothing saved.
      </p>

      {join && (
        <InviteBanner
          onDismiss={() => navigate({ to: "/chat", search: {}, replace: true })}
        />
      )}

      <div className="mt-6">
        {draft.ready ? (
          <IdentityCard
            alias={draft.alias}
            avatarSeed={draft.avatarSeed}
            maxAlias={draft.maxAlias}
            onAliasChange={draft.setAlias}
            onShuffle={draft.shuffle}
          />
        ) : (
          <Skeleton className="h-[150px] rounded-xl" />
        )}
      </div>

      <p className="text-muted-foreground mt-6 mb-2 text-[11px] font-medium tracking-wide uppercase">
        Your interests
      </p>
      <InterestPicker
        selected={draft.interests}
        onToggle={draft.toggleInterest}
      />

      <div className="pt-8">
        <Button
          size="lg"
          className="h-12 w-full rounded-full text-base"
          disabled={!draft.ready}
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
        {draft.ready && (
          <div className="mt-4 flex justify-center">
            <ShareCardAction
              label="Share your card"
              title="Your invite card"
              description="Post it to your story, then copy your link and add it with a link sticker where the dashed guide shows (the guide isn't on the shared image). Anyone who taps it lands on you while you're searching."
              filename="umamin-chat-invite.png"
              copyUrl={
                inviteCode
                  ? `${INVITE_BASE_URL}/?join=${inviteCode}`
                  : undefined
              }
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
        )}
      </div>

      <ClientOnlyAdContainer placement="chat_lobby" className="mt-6" />
    </div>
  );
}
