import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@umamin/ui/components/button";
import { ArrowRightIcon } from "lucide-react";
import { CipherText } from "@/components/landing/cipher-text";
import { ClaimPreview } from "@/components/landing/claim-preview";
import { CommunityWall } from "@/components/landing/community-wall";
import { FeatureBento } from "@/components/landing/feature-bento";
import { UmaShowcase } from "@/components/landing/uma-showcase";
import { PwaRedirect } from "@/components/pwa-redirect";
import { Uma } from "@/components/uma";
import { Link } from "@/lib/navigation";
import {
  pageSeo,
  SITE_DESCRIPTION,
  SITE_SLOGAN,
  SITE_TITLE,
  siteGraph,
} from "@/lib/seo";

export const Route = createFileRoute("/_marketing/")({
  // Landing page keeps the root's site-wide title/description; pageSeo re-emits
  // them here so the canonical + OG card are self-referential and absolute.
  head: () =>
    pageSeo({
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      path: "/",
      jsonLd: siteGraph(SITE_DESCRIPTION),
    }),
  component: Home,
});

const FACTS = [
  { value: "2022", label: "Started in the Philippines" },
  { value: "3M+", label: "People reached in total" },
  { value: "AES-256", label: "Encryption on stored messages" },
  { value: "Open", label: "Source, on GitHub" },
];

function Home() {
  return (
    <main className="overflow-x-clip pb-16">
      <PwaRedirect />

      <section className="relative px-6 pb-16 pt-28 md:pb-24 md:pt-36">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-14 xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
          <div>
            <p className="animate-rise pb-5 font-medium text-primary md:text-lg">
              {SITE_SLOGAN}
            </p>
            <h1 className="animate-rise-motion font-display text-5xl font-extrabold leading-[0.95] tracking-tighter sm:text-7xl xl:text-8xl">
              Say what you
              <br />
              <em className="text-primary">actually</em>{" "}
              <CipherText words={["think.", "feel.", "mean."]} />
            </h1>

            <p className="max-w-xl animate-rise pt-6 text-muted-foreground [animation-delay:200ms] md:text-lg">
              Umamin is a Filipino social media built around anonymity. Get
              anonymous messages, post notes with or without your name, join
              groups and talk to strangers.
            </p>

            <div className="flex animate-rise flex-wrap items-center gap-3 pt-8 [animation-delay:300ms]">
              <Button size="lg" className="rounded-full md:text-base" asChild>
                <Link to="/register">
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
                <Link to="/feed">Browse the feed</Link>
              </Button>
            </div>
          </div>

          <div className="relative animate-rise [animation-delay:350ms]">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-10 -z-10 rounded-full bg-primary/10 blur-3xl"
            />
            <CommunityWall />
            <p className="pt-3 text-xs text-muted-foreground">
              Example posts, not real accounts.
            </p>
          </div>
        </div>
      </section>

      <section aria-label="Umamin in numbers" className="border-y px-6">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 md:grid-cols-4">
          {FACTS.map((fact, i) => (
            <div
              key={fact.label}
              className={`flex flex-col gap-1 py-6 md:py-8 ${i % 2 === 1 ? "pl-6" : ""} ${i > 0 ? "md:border-l md:pl-6" : ""} ${i < 2 ? "border-b md:border-b-0" : ""} ${i % 2 === 1 ? "border-l" : ""}`}
            >
              <dt className="order-2 text-sm text-muted-foreground">
                {fact.label}
              </dt>
              <dd className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="playground" className="px-6 pt-20 md:pt-28">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-4xl font-extrabold tracking-tighter text-balance md:text-5xl">
            Five ways to be <em className="text-primary">nobody</em>.
          </h2>
          <p className="pt-3 text-muted-foreground md:text-lg">
            Every demo below works. Go ahead and poke it.
          </p>
          <div className="pt-10">
            <FeatureBento />
          </div>
        </div>
      </section>

      <section className="px-6 pt-20 md:pt-28">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <Uma className="uma-alive size-20 md:size-24" />
            <h2 className="pt-6 font-display text-4xl font-extrabold tracking-tighter text-balance md:text-5xl">
              Drama? Uma <em className="text-primary">folds it</em>.
            </h2>
            <p className="pt-4 text-muted-foreground md:text-lg">
              Meet Uma, the little folded card that checks new posts, comments
              and notes. Callouts, indirects and fights get folded so your feed
              stays chill. Slurs, threats and someone's private details get
              covered for everyone.
            </p>
            <p className="pt-4 text-muted-foreground md:text-lg">
              You can always tap a fold to read it, or turn folding off in
              Settings. Uma can be wrong, so people decide what gets removed.
            </p>
          </div>
          <UmaShowcase />
        </div>
      </section>

      <section className="relative overflow-hidden px-6 py-24 md:py-32">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 -z-10 size-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-16">
          <div className="text-center lg:text-left">
            <h2 className="font-display text-4xl font-extrabold tracking-tighter text-balance sm:text-5xl md:text-6xl">
              Ready to hear what they <em className="text-primary">really</em>{" "}
              think?
            </h2>
            <p className="pt-4 text-muted-foreground md:text-lg">
              Pick a username and your anonymous inbox is ready in thirty
              seconds.
            </p>
            <Button
              size="lg"
              variant="ghost"
              className="mt-6 rounded-full md:text-base lg:-ml-6"
              asChild
            >
              <Link to="/feed">I'm just here to lurk</Link>
            </Button>
          </div>
          <ClaimPreview />
        </div>
      </section>
    </main>
  );
}
