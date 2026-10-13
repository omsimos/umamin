import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@umamin/ui/components/tabs";
import {
  ArrowRightIcon,
  InboxIcon,
  MessageSquareQuoteIcon,
  MessagesSquareIcon,
  ScrollTextIcon,
  UsersIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { DemoChat } from "@/components/landing/demo-chat";
import { DemoGroups } from "@/components/landing/demo-groups";
import { DemoMessage } from "@/components/landing/demo-message";
import { DemoNotes } from "@/components/landing/demo-notes";
import { DemoSocial } from "@/components/landing/demo-social";
import { umaminChatUrl } from "@/lib/chat-link";
import { Link } from "@/lib/navigation";

type Feature = {
  id: string;
  label: string;
  icon: ReactNode;
  title: string;
  body: string;
  points: string[];
  cta: { label: string; href: string; external?: boolean };
  demo: ReactNode;
};

const FEATURES: Feature[] = [
  {
    id: "messages",
    label: "Messages",
    icon: <InboxIcon />,
    title: "An inbox anyone can write to",
    body: "Share your link and get anonymous messages from friends, classmates and strangers. Reply to keep the conversation going.",
    points: [
      "Messages are encrypted before they're stored",
      "Block words you never want to see",
      "Turn on the filter to cover hurtful ones",
    ],
    cta: { label: "Claim your link", href: "/register" },
    demo: <DemoMessage />,
  },
  {
    id: "notes",
    label: "Notes",
    icon: <ScrollTextIcon />,
    title: "Say one thing, out loud",
    body: "Post a short note, with or without your name, and attach a song. People reply to it anonymously.",
    points: [
      "One note at a time, always your latest",
      "Songs from Spotify, Apple Music, SoundCloud and YouTube",
    ],
    cta: { label: "Browse notes", href: "/notes" },
    demo: <DemoNotes />,
  },
  {
    id: "feed",
    label: "Feed",
    icon: <MessagesSquareIcon />,
    title: "A feed for everything else",
    body: "Posts, polls, quotes and comments, sorted by what's hot or what's new. Likes and comments earn aura points.",
    points: ["Polls and quote posts", "Mute anyone without them knowing"],
    cta: { label: "Open the feed", href: "/feed" },
    demo: <DemoSocial />,
  },
  {
    id: "groups",
    label: "Groups",
    icon: <UsersIcon />,
    title: "Wear your group's tag",
    body: "A group has a four-letter tag and up to 50 members, and members can show the tag next to their name. Accounts a year or older can start one; anyone can join.",
    points: ["Private and invite-only", "A group chat for members"],
    cta: { label: "Find your group", href: "/groups" },
    demo: <DemoGroups />,
  },
  {
    id: "chat",
    label: "Chat",
    icon: <MessageSquareQuoteIcon />,
    title: "Talk to a stranger, then it's gone",
    body: "Pick your interests and get matched with someone who shares one. When the chat ends, it's deleted.",
    points: ["No account needed", "Nothing is kept after the chat"],
    cta: {
      label: "Start a chat",
      href: umaminChatUrl("landing"),
      external: true,
    },
    demo: <DemoChat />,
  },
];

const ctaClass =
  "inline-flex items-center gap-1.5 text-sm font-semibold text-primary";

export function FeatureTour() {
  return (
    <Tabs defaultValue="messages" className="gap-8">
      <TabsList className="grid h-auto w-full grid-cols-5 gap-1 rounded-2xl p-1 sm:inline-flex sm:w-auto sm:rounded-full">
        {FEATURES.map((f) => (
          <TabsTrigger
            key={f.id}
            value={f.id}
            className="flex-col gap-1 rounded-xl px-1 py-2 text-xs sm:flex-row sm:gap-1.5 sm:rounded-full sm:px-4 sm:text-sm"
          >
            {f.icon}
            {f.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {FEATURES.map((f) => (
        <TabsContent
          key={f.id}
          value={f.id}
          className="grid animate-rise grid-cols-1 items-start gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] md:gap-12"
        >
          <div className="md:pt-4">
            <h3 className="font-display text-3xl font-extrabold tracking-tight text-balance md:text-4xl">
              {f.title}
            </h3>
            <p className="max-w-md pt-4 text-muted-foreground md:text-lg">
              {f.body}
            </p>
            <ul className="grid gap-2 pt-6">
              {f.points.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm">
                  <span
                    aria-hidden
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                  />
                  {point}
                </li>
              ))}
            </ul>
            <div className="pt-6">
              {f.cta.external ? (
                <a
                  href={f.cta.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={ctaClass}
                >
                  {f.cta.label}
                  <ArrowRightIcon className="size-4" />
                </a>
              ) : (
                <Link href={f.cta.href} className={ctaClass}>
                  {f.cta.label}
                  <ArrowRightIcon className="size-4" />
                </Link>
              )}
            </div>
          </div>

          <div className="rounded-3xl border bg-card p-5 shadow-xl">
            {f.demo}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
