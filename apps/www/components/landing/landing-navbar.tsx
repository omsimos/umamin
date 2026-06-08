"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import Link from "next/link";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";
import { ThemeToggleButton } from "../theme-toggle-button";
import { UmaminLogo } from "../umamin-logo";

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
        <Link href="/" aria-label="umamin" className="flex items-center">
          <UmaminLogo className="size-7" />
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <Link href="https://github.com/omsimos/umamin" target="_blank">
              GitHub
            </Link>
          </Button>

          <ThemeToggleButton />

          <Button asChild className="rounded-full">
            <Link href={isAuthenticated ? "/feed" : "/login"}>
              {isAuthenticated ? "Open app" : "Log in"}
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
