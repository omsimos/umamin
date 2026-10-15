import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Badge } from "@umamin/ui/components/badge";
import { Button } from "@umamin/ui/components/button";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { ArrowRightIcon, Share2Icon } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { ClientOnlyAdContainer } from "@/components/ad-container-client";
import { AppHeader } from "@/components/app-header";
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
import { useChatSession } from "./-umamin-chat/session/chat-context";

const TITLE = "Umamin Chat — Anonymous conversations with unexpected people";
const DESCRIPTION =
  "Get matched with a stranger who shares your interests and start a real-time, anonymous chat. No sign-up, no history, nothing saved.";

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
      <AppHeader />
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
              toast("They're not around. Finding you someone new"),
          }
        : undefined,
    );
    navigate({ to: "/chat/session" });
  }

  return (
    <div className="container mx-auto flex w-full max-w-lg flex-col gap-6 pb-28 lg:pb-12">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          Chat
          <Badge variant="secondary" className="font-normal">
            Beta
          </Badge>
        </h1>
        <p className="text-muted-foreground text-sm">
          Talk one on one with someone who shares your interests. Anonymous, and
          nothing is saved.
        </p>
      </header>

      {join && (
        <InviteBanner
          onDismiss={() => navigate({ to: "/chat", search: {}, replace: true })}
        />
      )}

      {draft.ready ? (
        <IdentityCard
          alias={draft.alias}
          avatarSeed={draft.avatarSeed}
          maxAlias={draft.maxAlias}
          onAliasChange={draft.setAlias}
          onShuffle={draft.shuffle}
        />
      ) : (
        <Skeleton className="h-[106px] rounded-xl" />
      )}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-muted-foreground text-sm font-medium">
            Interests
          </h2>
          <p className="text-muted-foreground text-xs">
            {draft.interests.length > 0
              ? `${draft.interests.length} selected · matches on any`
              : "None picked · matches with anyone"}
          </p>
        </div>
        <InterestPicker
          selected={draft.interests}
          onToggle={draft.toggleInterest}
        />
      </section>

      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          className="h-11 w-full text-base"
          disabled={!draft.ready}
          onClick={start}
        >
          Find someone to chat with
          <ArrowRightIcon />
        </Button>
        {draft.ready && (
          <ShareCardAction
            label="Share your card"
            title="Your invite card"
            description="Post it to your story, then copy your link and add it with a link sticker where the dashed guide shows (the guide isn't on the shared image). Anyone who taps it lands on you while you're searching."
            filename="umamin-chat-invite.png"
            copyUrl={
              inviteCode ? absoluteUrl(`/chat?join=${inviteCode}`) : undefined
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
                className="text-muted-foreground w-full"
                onClick={open}
              >
                <Share2Icon />
                Invite a friend with your card
              </Button>
            )}
          />
        )}
      </div>

      <ClientOnlyAdContainer placement="chat_lobby" />
    </div>
  );
}
