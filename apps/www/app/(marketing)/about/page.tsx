import { Button } from "@umamin/ui/components/button";
import {
  ArrowRightIcon,
  InboxIcon,
  MessageSquareQuoteIcon,
  MessagesSquareIcon,
  ScrollTextIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ProductCard } from "@/components/landing/product-card";
import { umaminChatUrl } from "@/lib/chat-link";

const title = "Umamin — About";
const description =
  "The story of Umamin — an open-source anonymous platform founded in July 2022 that reached over 700,000 users in its first week, now a broader social space for self-expression, community, and meaningful conversations.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/about" },
  openGraph: {
    type: "website",
    siteName: "Umamin",
    url: "https://www.umamin.link/about",
    title,
    description,
    // Re-declare the site OG image: a page-level openGraph shallow-replaces the
    // root's, which would otherwise drop the opengraph-image.png file convention.
    images: ["/opengraph-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/twitter-image.png"],
  },
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-dashed px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
      {children}
    </span>
  );
}

export default function AboutPage() {
  return (
    <main className="overflow-x-clip pb-16">
      <section className="relative px-6 pb-14 pt-36 md:pt-44">
        <div className="mx-auto max-w-5xl">
          <p className="animate-rise font-mono text-xs uppercase tracking-widest text-muted-foreground [animation-delay:50ms]">
            About
          </p>
          <h1 className="animate-rise pt-4 font-display text-5xl font-extrabold leading-[0.95] tracking-tighter [animation-delay:100ms] sm:text-6xl md:text-7xl">
            The story of <em className="text-primary">Umamin</em>.
          </h1>
          <p className="max-w-2xl animate-rise pt-6 text-muted-foreground [animation-delay:200ms] md:text-lg">
            An open-source anonymous platform that went from a weekend project
            to hundreds of thousands of people in a matter of days — and never
            stopped growing.
          </p>
          <p className="animate-rise pt-6 font-mono text-xs text-muted-foreground [animation-delay:300ms]">
            founded July 2022 · Philippines
          </p>
        </div>
      </section>

      <section className="px-6 py-12 md:py-14">
        <div className="mx-auto max-w-3xl">
          <SectionLabel>2022 · the beginning</SectionLabel>
          <p className="pt-5 text-lg leading-relaxed text-muted-foreground">
            Umamin is an open-source project founded by{" "}
            <strong className="font-medium text-foreground">
              Josh Daniel Bañares
            </strong>{" "}
            and later co-founded with{" "}
            <strong className="font-medium text-foreground">
              Joseph Dale Bañares
            </strong>{" "}
            and{" "}
            <strong className="font-medium text-foreground">
              Prince Carlo Juguilon
            </strong>{" "}
            in July 2022. Shortly after its initial release, the platform went
            viral in the Philippines and reached more than{" "}
            <strong className="font-medium text-foreground">
              700,000 users in less than a week
            </strong>
            .
          </p>
        </div>
      </section>

      <section className="relative px-6 py-12 md:py-16">
        <div className="mx-auto max-w-3xl">
          <SectionLabel>the numbers</SectionLabel>
          <h2 className="pt-5 font-display text-3xl font-extrabold tracking-tighter md:text-4xl">
            What virality looked like from the{" "}
            <em className="text-primary">inside</em>.
          </h2>
          <p className="pt-3 text-muted-foreground">
            Four days in July 2022 — the week Umamin spread across the
            Philippines.
          </p>
        </div>

        <figure className="relative mx-auto mt-10 max-w-4xl">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 -z-10 size-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl"
          />
          <div className="overflow-hidden rounded-2xl border bg-card shadow-xl">
            <div className="flex items-center gap-2 border-b border-dashed px-4 py-3">
              <span className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-red-400/70" />
                <span className="size-2.5 rounded-full bg-amber-400/70" />
                <span className="size-2.5 rounded-full bg-green-400/70" />
              </span>
              <span className="ml-1 font-mono text-xs text-muted-foreground">
                Google Analytics · Jul 2022
              </span>
            </div>
            <Image
              src="/screenshots/first-week-analytics.png"
              alt="Google Analytics dashboard for Umamin's first week: 702K active users, 2.7M views, and 9.3M events between July 28 and July 31, 2022."
              width={1454}
              height={844}
              sizes="(min-width: 896px) 896px, 100vw"
              className="h-auto w-full bg-white"
            />
          </div>
          <figcaption className="pt-4 text-center font-mono text-xs text-muted-foreground">
            Umamin's first week — Jul 28–31, 2022
          </figcaption>
        </figure>
      </section>

      <section className="px-6 py-12 md:py-14">
        <div className="mx-auto max-w-3xl">
          <SectionLabel>the collective</SectionLabel>
          <p className="pt-5 text-lg leading-relaxed text-muted-foreground">
            The team later formed the{" "}
            <a
              href="https://github.com/omsimos"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-primary"
            >
              Omsimos Developer Collective
            </a>
            , an initiative focused on building open-source projects, including
            Umamin — an anonymous platform originally created for sending and
            receiving anonymous messages.
          </p>
        </div>
      </section>

      <section className="px-6 py-12 md:py-14">
        <div className="mx-auto max-w-3xl">
          <SectionLabel>today</SectionLabel>
          <p className="pt-5 text-lg leading-relaxed text-muted-foreground">
            Today, Umamin is solely maintained and developed by its original
            creator,{" "}
            <strong className="font-medium text-foreground">Josh Daniel</strong>
            . What began as a simple anonymous messaging platform has since
            evolved into a broader social platform built around community
            interaction, self-expression, and meaningful conversations.
          </p>
        </div>
      </section>

      <section className="px-6 py-12 md:py-16">
        <div className="mx-auto max-w-5xl">
          <SectionLabel>what's inside</SectionLabel>
          <h2 className="pt-5 font-display text-3xl font-extrabold tracking-tighter md:text-4xl">
            More than a message box.
          </h2>
          <p className="max-w-2xl pt-3 text-muted-foreground">
            What started as a single anonymous inbox is now four ways to
            connect:
          </p>

          <div className="grid gap-4 pt-10 md:grid-cols-2">
            <ProductCard
              name="Umamin Messages"
              tag="classic"
              accent="bg-primary/15 text-primary"
              icon={<InboxIcon className="size-4" />}
              cta={{ label: "Claim your link", href: "/register" }}
            >
              <p className="text-sm leading-relaxed text-muted-foreground">
                The original — a personal link where anyone can send you an
                encrypted anonymous message.
              </p>
            </ProductCard>

            <ProductCard
              name="Umamin Notes"
              tag="out loud"
              accent="bg-amber-400/15 text-amber-500"
              icon={<ScrollTextIcon className="size-4" />}
              cta={{ label: "Browse notes", href: "/notes" }}
            >
              <p className="text-sm leading-relaxed text-muted-foreground">
                Post a note out loud for anyone to reply to. Formerly Umamin
                Global, it became one of the most important features in bringing
                the community together.
              </p>
            </ProductCard>

            <ProductCard
              name="Umamin Social"
              tag="the feed"
              accent="bg-sky-400/15 text-sky-400"
              icon={<MessagesSquareIcon className="size-4" />}
              cta={{ label: "Open the feed", href: "/feed" }}
            >
              <p className="text-sm leading-relaxed text-muted-foreground">
                A feed of anonymous posts and hot takes — react and join the
                conversation without a name attached.
              </p>
            </ProductCard>

            <ProductCard
              name="Umamin Chat"
              tag="new"
              accent="bg-violet-400/15 text-violet-400"
              icon={<MessageSquareQuoteIcon className="size-4" />}
              cta={{
                label: "Start a chat",
                href: umaminChatUrl("about"),
                external: true,
              }}
            >
              <p className="text-sm leading-relaxed text-muted-foreground">
                Get matched with anonymous strangers based on shared interests,
                then talk in a chat that self-destructs when you're done.
              </p>
            </ProductCard>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden px-6 py-20 md:py-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 -z-10 size-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-4xl font-extrabold tracking-tighter sm:text-5xl">
            A place to feel <em className="text-primary">heard</em>.
          </h2>
          <p className="mx-auto max-w-xl pt-4 text-muted-foreground md:text-lg">
            Thousands of people use Umamin every day. As it grows, the goal
            stays the same: a space to express yourself freely, connect with
            others, and feel heard.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-8">
            <Button size="lg" className="rounded-full md:text-base" asChild>
              <Link href="/register">
                Create your profile
                <ArrowRightIcon />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full md:text-base"
              asChild
            >
              <Link href="/feed">Browse the feed</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
