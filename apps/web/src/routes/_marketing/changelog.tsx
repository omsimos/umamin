import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRightIcon } from "lucide-react";
import {
  type ChangelogRelease,
  formatReleaseDate,
  parseChangelog,
  tokenizeInline,
} from "@/lib/changelog";
import { pageSeo } from "@/lib/seo";
import changelogMarkdown from "../../../../../CHANGELOG.md?raw";

const title = "Changelog | Umamin";
const description =
  "Every Umamin release, newest first: new features, changes, fixes, and privacy and security improvements.";

const releases = parseChangelog(changelogMarkdown);

export const Route = createFileRoute("/_marketing/changelog")({
  head: () => pageSeo({ title, description, path: "/changelog" }),
  component: ChangelogPage,
});

function InlineText({ text }: { text: string }) {
  return tokenizeInline(text).map((token, i) => {
    const key = `${i}-${token.type}`;
    switch (token.type) {
      case "code":
        return (
          <code
            key={key}
            className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground"
          >
            {token.value}
          </code>
        );
      case "strong":
        return (
          <strong key={key} className="font-medium text-foreground">
            {token.value}
          </strong>
        );
      case "link":
        return (
          <a
            key={key}
            href={token.href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-primary"
          >
            {token.value}
          </a>
        );
      default:
        return token.value;
    }
  });
}

function Release({
  release,
  latest,
}: {
  release: ChangelogRelease;
  latest: boolean;
}) {
  const id = `v${release.version}`;

  return (
    <article
      id={id}
      aria-labelledby={`${id}-heading`}
      className="scroll-mt-24 border-t border-dashed py-10 md:grid md:grid-cols-[10rem_1fr] md:gap-10"
    >
      <header className="md:sticky md:top-24 md:self-start">
        <h2
          id={`${id}-heading`}
          className="flex items-center gap-2 font-display text-2xl font-extrabold tracking-tighter"
        >
          <a href={`#${id}`} className="transition-colors hover:text-primary">
            {release.version}
          </a>
          {latest && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-sans text-xs font-medium tracking-normal text-primary">
              Latest
            </span>
          )}
        </h2>
        {release.date && (
          <time
            dateTime={release.date}
            className="block pt-1 text-sm text-muted-foreground"
          >
            {formatReleaseDate(release.date)}
          </time>
        )}
      </header>

      <div className="flex flex-col gap-7 pt-5 md:pt-1">
        {release.summary && (
          <p className="leading-relaxed text-muted-foreground">
            <InlineText text={release.summary} />
          </p>
        )}
        {release.sections.map((section) => (
          <section key={section.title}>
            <h3 className="text-sm font-semibold">{section.title}</h3>
            <ul className="flex list-disc flex-col gap-2.5 pt-3 pl-5 leading-relaxed marker:text-muted-foreground/60">
              {section.items.map((item) => (
                <li key={item}>
                  <InlineText text={item} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}

function ChangelogPage() {
  return (
    <main className="overflow-x-clip px-6 pb-16">
      <section className="pb-12 pt-36 md:pt-44">
        <div className="mx-auto max-w-3xl">
          <h1 className="animate-rise font-display text-5xl font-extrabold leading-[0.95] tracking-tighter [animation-delay:100ms] sm:text-6xl">
            What's <em className="text-primary">new</em>.
          </h1>
          <p className="max-w-xl animate-rise pt-6 text-muted-foreground [animation-delay:200ms] md:text-lg">
            Every Umamin release, newest first. Umamin is open source, so you
            can follow the work as it happens on GitHub.
          </p>
          <a
            href="https://github.com/omsimos/umamin"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex animate-rise items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-sm text-muted-foreground transition-colors [animation-delay:300ms] hover:border-primary hover:text-primary"
          >
            omsimos/umamin
            <ArrowUpRightIcon className="size-3" />
          </a>
        </div>
      </section>

      <div className="mx-auto max-w-3xl">
        {releases.map((release, i) => (
          <Release key={release.version} release={release} latest={i === 0} />
        ))}
      </div>
    </main>
  );
}
