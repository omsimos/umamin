import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@umamin/ui/components/button";
import { ArrowRightIcon } from "lucide-react";
import { CipherText } from "@/components/landing/cipher-text";
import { CommunityWall } from "@/components/landing/community-wall";
import { FeatureBento } from "@/components/landing/feature-bento";
import { HeroPreview } from "@/components/landing/hero-preview";
import { UmaShowcase } from "@/components/landing/uma-showcase";
import { PwaRedirect } from "@/components/pwa-redirect";
import { Uma } from "@/components/uma";
import { Link } from "@/lib/navigation";
import { pageSeo, SITE_DESCRIPTION, SITE_TITLE, siteGraph } from "@/lib/seo";

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
  { value: "700K+", label: "People in the first week" },
  { value: "AES-256", label: "Encryption on stored messages" },
  { value: "Open", label: "Source, on GitHub" },
];

function Home() {
  return (
    <main className="overflow-x-clip pb-16">
      <PwaRedirect />

      <section className="relative px-6 pb-16 pt-32 md:pb-24 md:pt-40">
        <div className="mx-auto grid grid-cols-1 max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-16">
          <div>
            <h1 className="animate-rise-motion font-display text-5xl font-extrabold leading-[0.95] tracking-tighter sm:text-7xl xl:text-8xl">
              Say what you
              <br />
              <em className="text-primary">actually</em>{" "}
              <CipherText words={["think.", "feel.", "mean.", "won't say."]} />
            </h1>

            <p className="max-w-xl animate-rise pt-6 text-muted-foreground [animation-delay:200ms] md:text-lg">
              Umamin is where people say the things they wouldn't say with their
              name on it. Get anonymous messages, post notes and hot takes, join
              groups, and talk to strangers.
            </p>

            <div className="flex animate-rise flex-wrap items-center gap-3 pt-8 [animation-delay:300ms]">
              <Button
                size="lg"
                variant="outline"
                className="rounded-full md:text-base"
                asChild
              >
                <Link to="/feed">
                  Browse the feed
                  <ArrowRightIcon />
                </Link>
              </Button>
            </div>
          </div>

          <div className="animate-rise [animation-delay:350ms]">
            <HeroPreview />
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

      <section className="px-6 pt-20 md:pt-28">
        <div className="mx-auto grid grid-cols-1 max-w-6xl gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16">
          <div className="lg:pt-16">
            <h2 className="font-display text-4xl font-extrabold tracking-tighter text-balance md:text-5xl">
              Made by the people <em className="text-primary">on it</em>.
            </h2>
            <p className="pt-4 text-muted-foreground md:text-lg">
              Late-night thoughts, study-spot polls, song recs and the messages
              people were too shy to send with their name. Students, friend
              groups and strangers fill it every day.
            </p>
            <p className="pt-6 text-xs text-muted-foreground">
              Examples of the kinds of things people share. Names and posts are
              made up.
            </p>
          </div>
          <CommunityWall />
        </div>
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
        <div className="mx-auto grid grid-cols-1 max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <div className="flex items-center gap-3">
              <Uma className="size-12" />
              <p className="font-semibold">Meet Uma</p>
            </div>
            <h2 className="pt-4 font-display text-4xl font-extrabold tracking-tighter text-balance md:text-5xl">
              Less drama in your feed,{" "}
              <em className="text-primary">your call</em>.
            </h2>
            <p className="pt-4 text-muted-foreground md:text-lg">
              Uma checks new posts, comments and notes. It folds the ones that
              look like callouts, indirects or fights, and covers anything that
              may contain slurs, threats or someone's private details.
            </p>
            <ul className="grid gap-2 pt-6 text-sm">
              <li className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                />
                Tap anything Uma folded to read it.
              </li>
              <li className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                />
                Turn folding off in Settings whenever you want.
              </li>
              <li className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                />
                Uma is automated and can be wrong, so people decide what gets
                removed.
              </li>
            </ul>
          </div>
          <UmaShowcase />
        </div>
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
              <Link to="/register">
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
              <Link to="/feed">I'm just here to lurk</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
