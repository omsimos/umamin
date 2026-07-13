import { ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";
import { UmaminLogo } from "@/components/umamin-logo";
import { umaminChatUrl } from "@/lib/chat-link";

const PRODUCTS = [
  { label: "Messages", href: "/login" },
  { label: "Notes", href: "/notes" },
  { label: "Social", href: "/feed" },
  { label: "Chat", href: umaminChatUrl("footer"), external: true },
];

const RESOURCES = [
  { label: "About", href: "/about" },
  {
    label: "GitHub",
    href: "https://github.com/omsimos/umamin",
    external: true,
  },
  {
    label: "Release notes",
    href: "https://github.com/omsimos/umamin/releases",
    external: true,
  },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Child Safety", href: "/child-safety" },
];

function FooterLinks({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string; external?: boolean }[];
}) {
  return (
    <div>
      <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
      <ul className="space-y-2.5 pt-4 text-sm">
        {links.map((link) => (
          <li key={link.label}>
            {link.external ? (
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 transition-colors hover:text-primary"
              >
                {link.label}
                <ArrowUpRightIcon className="size-3 text-muted-foreground" />
              </a>
            ) : (
              <Link
                href={link.href}
                className="transition-colors hover:text-primary"
              >
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-dashed px-6 pb-24 pt-14 lg:pb-14">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-12 md:flex-row md:justify-between">
          <div className="max-w-xs">
            <UmaminLogo className="size-8" />
            <p className="pt-4 text-sm text-muted-foreground">
              The open-source platform for anonymity, built in public by{" "}
              <a
                className="font-medium underline underline-offset-4 transition-colors hover:text-primary"
                href="https://www.instagram.com/josh.xfi/"
                target="_blank"
                rel="noopener noreferrer"
              >
                @josh.xfi
              </a>{" "}
              and{" "}
              <a
                className="font-medium underline underline-offset-4 transition-colors hover:text-primary"
                href="https://github.com/omsimos/umamin/graphs/contributors"
                target="_blank"
                rel="noopener noreferrer"
              >
                contributors
              </a>
              .
            </p>
            <Link
              href="/to/umamin"
              className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              say it anonymously — even to us
              <ArrowUpRightIcon className="size-3" />
            </Link>
          </div>

          <nav aria-label="Footer" className="flex gap-16 md:gap-24">
            <FooterLinks title="Products" links={PRODUCTS} />
            <FooterLinks title="Resources" links={RESOURCES} />
          </nav>
        </div>

        <p className="pt-14 font-mono text-xs text-muted-foreground">
          © 2022-2026 Umamin. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
