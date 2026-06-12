"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import Image from "next/image";
import Link from "next/link";
import { PwaInstallButton } from "@/components/pwa-install-button";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";

// Marketing-only top bar: logo + a GitHub link, theme toggle, and an entry CTA
// (Open app when signed in, otherwise Log in). Separate from the in-app Navbar
// so the landing isn't dressed in app chrome.
export function LandingNavbar() {
  const { data } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
  });

  const isAuthenticated = Boolean(data?.user);

  return (
    <header className="fixed inset-x-0 top-0 z-50 w-full border-b border-border/40 bg-background/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          aria-label="umamin"
          className="flex items-center gap-x-2"
        >
          <Image
            src="/umamin-chat-logo.png"
            alt=""
            width={24}
            height={24}
            className="size-6 rounded-md"
          />

          <h2 className="font-display font-bold tracking-tighter text-lg">
            umamin
          </h2>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <Link href="https://github.com/omsimos/umamin" target="_blank">
              GitHub
            </Link>
          </Button>

          <PwaInstallButton />

          <Button asChild className="rounded-full">
            <Link href={isAuthenticated ? "/feed" : "/login"}>
              {isAuthenticated ? "Open" : "Log in"}
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
