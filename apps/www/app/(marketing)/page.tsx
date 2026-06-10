import { Button } from "@umamin/ui/components/button";
import {
  ArrowRightIcon,
  InboxIcon,
  MessageSquareQuoteIcon,
  MessagesSquareIcon,
  ScrollTextIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { GridPattern } from "@/components/grid-pattern";
import { CipherText } from "@/components/landing/cipher-text";
import { DemoChat } from "@/components/landing/demo-chat";
import { DemoMessage } from "@/components/landing/demo-message";
import { DemoNotes } from "@/components/landing/demo-notes";
import { DemoSocial } from "@/components/landing/demo-social";
import { Marquee } from "@/components/landing/marquee";
import { ProductCard } from "@/components/landing/product-card";
import { PwaRedirectGate } from "@/components/pwa-redirect-gate";
import { umaminChatUrl } from "@/lib/chat-link";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <main className="overflow-x-clip pb-16">
      <Suspense fallback={null}>
        <PwaRedirectGate />
      </Suspense>

      <section className="relative px-6 pb-20 pt-36 md:pb-28 md:pt-44">
        <div
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
          aria-hidden="true"
        >
          <div className="absolute inset-0 opacity-20">
            <GridPattern />
          </div>
          <div className="absolute -top-24 right-[6%] size-96 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute bottom-0 left-[2%] size-72 rounded-full bg-violet-500/10 blur-3xl" />
        </div>

        <div className="mx-auto max-w-5xl">
          <p className="inline-flex animate-rise items-center gap-2 rounded-full border border-dashed px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            The platform for anonymity
          </p>

          <h1 className="animate-rise pt-6 font-display text-5xl font-extrabold leading-[0.95] tracking-tighter [animation-delay:100ms] sm:text-7xl md:text-8xl">
            Say what you
            <br />
            <em className="text-primary">actually</em>{" "}
            <CipherText words={["think.", "feel.", "mean.", "won't say."]} />
          </h1>

          <p className="max-w-xl animate-rise pt-6 text-muted-foreground [animation-delay:200ms] md:text-lg">
            Umamin is the open-source playground for anonymity — encrypted
            anonymous messages, notes strangers reply to, a feed of unowned hot
            takes, and chats that self-destruct.
          </p>

          <div className="flex animate-rise flex-wrap items-center gap-3 pt-8 [animation-delay:300ms]">
            <Button size="lg" className="rounded-full md:text-base" asChild>
              <Link href="/register">
                Claim your link
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

          <p className="animate-rise pt-6 font-mono text-xs text-muted-foreground [animation-delay:400ms]">
            umamin.link/to/<span className="text-primary">you</span>
          </p>
        </div>
      </section>

      <Marquee />

      <section id="playground" className="px-6 pb-8 pt-20 md:pt-28">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-4xl font-extrabold tracking-tighter md:text-5xl">
            Four ways to be <em className="text-primary">nobody</em>.
          </h2>
          <p className="pt-3 text-muted-foreground md:text-lg">
            Every card below is a live demo — go ahead, poke them.
          </p>

          <div className="grid gap-4 pt-10 md:grid-cols-2">
            <ProductCard
              name="Messages"
              tag="the classic"
              accent="bg-primary/15 text-primary"
              icon={<InboxIcon className="size-4" />}
              cta={{ label: "Claim your link", href: "/register" }}
            >
              <DemoMessage />
            </ProductCard>

            <ProductCard
              name="Notes"
              tag="say it out loud"
              accent="bg-amber-400/15 text-amber-500"
              icon={<ScrollTextIcon className="size-4" />}
              cta={{ label: "Browse notes", href: "/notes" }}
            >
              <DemoNotes />
            </ProductCard>

            <ProductCard
              name="Social"
              tag="the feed"
              accent="bg-sky-400/15 text-sky-400"
              icon={<MessagesSquareIcon className="size-4" />}
              cta={{ label: "Open the feed", href: "/feed" }}
            >
              <DemoSocial />
            </ProductCard>

            <ProductCard
              name="Chat"
              tag="new"
              accent="bg-violet-400/15 text-violet-400"
              icon={<MessageSquareQuoteIcon className="size-4" />}
              cta={{
                label: "Start a chat",
                href: umaminChatUrl("landing"),
                external: true,
              }}
            >
              <DemoChat />
            </ProductCard>
          </div>
        </div>
      </section>

      <section className="px-6 py-10">
        <p className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-4 gap-y-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          <span>AES-256 at rest</span>
          <span className="text-primary">✦</span>
          <a
            href="https://github.com/omsimos/umamin"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 transition-colors hover:text-foreground"
          >
            Open source on GitHub
          </a>
          <span className="text-primary">✦</span>
          <span>Free forever</span>
        </p>
      </section>

      <section className="relative overflow-hidden px-6 py-24 md:py-32">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 -z-10 size-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-4xl font-extrabold tracking-tighter sm:text-5xl md:text-6xl">
            Ready to hear what they <em className="text-primary">really</em>{" "}
            think?
          </h2>
          <p className="pt-4 text-muted-foreground md:text-lg">
            Your anonymous inbox takes thirty seconds to set up.
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
              variant="ghost"
              className="rounded-full md:text-base"
              asChild
            >
              <Link href="/feed">I'm just here to lurk</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
