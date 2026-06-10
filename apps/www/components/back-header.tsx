"use client";

import { Button } from "@umamin/ui/components/button";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { HeaderMenu } from "./header-menu";
import { UmaminLogo } from "./umamin-logo";

// Mobile focused-view header (lg:hidden) for secondary pages (profile, inbox,
// notifications, settings): back to the feed (left), centered umamin logo, and
// a three-dot shortcuts menu (right). Desktop keeps the Navbar.
export function BackHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 w-full bg-background bg-opacity-40 bg-clip-padding pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-filter lg:hidden">
      <div className="container relative flex h-16 max-w-7xl items-center justify-between">
        <Button variant="ghost" size="icon" aria-label="Back to feed" asChild>
          <Link href="/feed">
            <ArrowLeftIcon className="size-5" />
          </Link>
        </Button>

        <Link
          href="/feed"
          aria-label="umamin"
          className="absolute left-1/2 -translate-x-1/2"
        >
          <UmaminLogo className="size-8" />
        </Link>

        <HeaderMenu />
      </div>
    </header>
  );
}
