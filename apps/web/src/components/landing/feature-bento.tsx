import { cn } from "@umamin/ui/lib/utils";
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
import { useChatLink } from "@/hooks/use-chat-link";
import { Link } from "@/lib/navigation";

type Feature = {
  name: string;
  icon: ReactNode;
  accent: string;
  title: string;
  body: string;
  cta: { label: string; href: string; external?: boolean };
  demo: ReactNode;
  // Wide cards put the copy beside the demo on large screens.
  wide?: boolean;
  className?: string;
};

const FEATURES: Feature[] = [
  {
    name: "Messages",
    icon: <InboxIcon />,
    accent: "bg-primary/15 text-primary",
    title: "An inbox anyone can write to",
    body: "Share your link and get anonymous messages from friends, classmates and strangers. They're encrypted before they're stored.",
    cta: { label: "Claim your link", href: "/register" },
    demo: <DemoMessage />,
    wide: true,
    className: "md:col-span-2",
  },
  {
    name: "Notes",
    icon: <ScrollTextIcon />,
    accent: "bg-amber-400/15 text-amber-500",
    title: "Say one thing, out loud",
    body: "Post a short note, with or without your name, and attach a song. People reply anonymously.",
    cta: { label: "Browse notes", href: "/notes" },
    demo: <DemoNotes />,
  },
  {
    name: "Feed",
    icon: <MessagesSquareIcon />,
    accent: "bg-sky-400/15 text-sky-500",
    title: "Hot takes, sorted",
    body: "Posts, polls and quotes. Likes and comments earn aura points.",
    cta: { label: "Open the feed", href: "/feed" },
    demo: <DemoSocial />,
  },
  {
    name: "Groups",
    icon: <UsersIcon />,
    accent: "bg-emerald-400/15 text-emerald-500",
    title: "Wear your group's tag",
    body: "Up to 50 members, private and invite-only. Members can show the four-letter tag next to their name.",
    cta: { label: "Find your group", href: "/groups" },
    demo: <DemoGroups />,
  },
  {
    name: "Chat",
    icon: <MessageSquareQuoteIcon />,
    accent: "bg-violet-400/15 text-violet-500",
    title: "Talk to a stranger, then it's gone",
    body: "Pick your interests and get matched with someone who shares one. No account needed, and nothing is kept after the chat ends.",
    // Resolved per render from the rollout flag (see FeatureBento).
    cta: { label: "Start a chat", href: "", external: true },
    demo: <DemoChat />,
  },
];

const ctaClass =
  "inline-flex items-center gap-1.5 text-sm font-semibold text-primary";

function BentoCard({ feature: f }: { feature: Feature }) {
  const cta = f.cta.external ? (
    <a
      href={f.cta.href}
      target="_blank"
      rel="noopener noreferrer"
      className={ctaClass}
    >
      {f.cta.label}
      <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
    </a>
  ) : (
    <Link href={f.cta.href} className={ctaClass}>
      {f.cta.label}
      <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );

  return (
    <article
      className={cn(
        "group flex min-w-0 flex-col gap-5 rounded-3xl border bg-card p-5 transition-colors hover:border-foreground/20 sm:p-6",
        f.wide &&
          "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-10",
        f.className,
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "grid size-9 place-items-center rounded-xl [&_svg]:size-4",
              f.accent,
            )}
          >
            {f.icon}
          </span>
          <span className="font-semibold">{f.name}</span>
        </div>
        <h3 className="font-display text-2xl font-extrabold tracking-tight text-balance">
          {f.title}
        </h3>
        <p className="text-sm text-muted-foreground">{f.body}</p>
        {f.wide && <div className="hidden pt-1 lg:block">{cta}</div>}
      </div>
      <div className="flex flex-1 flex-col justify-center rounded-2xl bg-muted/40 p-4">
        {f.demo}
      </div>
      <div className={cn(f.wide && "lg:hidden")}>{cta}</div>
    </article>
  );
}

export function FeatureBento() {
  const chat = useChatLink("landing");

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map((f) => (
        <BentoCard
          key={f.name}
          feature={f.name === "Chat" ? { ...f, cta: { ...f.cta, ...chat } } : f}
        />
      ))}
    </div>
  );
}
