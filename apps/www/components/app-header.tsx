"use client";

import Link from "next/link";
import { AccountSheet } from "./account-sheet";
import { UmaminLogo } from "./umamin-logo";

// Mobile top bar (lg:hidden) for feed + notes: the account avatar (top-left)
// opens the drawer, which holds the theme toggle; the logo is centered and
// notifications live in the bottom nav.
export function AppHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 w-full bg-background bg-opacity-40 bg-clip-padding pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-filter lg:hidden">
      <div className="container relative flex h-16 max-w-7xl items-center">
        <AccountSheet />

        <Link
          href="/feed"
          aria-label="umamin"
          className="absolute left-1/2 -translate-x-1/2"
        >
          <UmaminLogo className="size-8" />
        </Link>
      </div>
    </header>
  );
}
