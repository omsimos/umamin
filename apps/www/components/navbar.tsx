"use client";

import { Badge } from "@umamin/ui/components/badge";
import Link from "next/link";
import { isStandaloneMode } from "@/lib/pwa";
// import { PwaInstallButton } from "./pwa-install-button";
import { ThemeToggle } from "./theme-toggle";

export function Navbar() {
  const version = process.env.NEXT_PUBLIC_VERSION
    ? process.env.NEXT_PUBLIC_VERSION
    : "v3.0.0";

  if (isStandaloneMode()) {
    return null;
  }

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 w-full bg-background bg-opacity-40 bg-clip-padding py-5 backdrop-blur-xl backdrop-filter lg:z-40 container max-w-7xl">
      <div className="flex justify-between items-center">
        <div className="space-x-2 flex items-center">
          <Link href="/" aria-label="logo">
            <span className="font-semibold text-foreground">umamin</span>
            <span className="text-muted-foreground font-medium">.link</span>
          </Link>

          <Link
            href={`https://github.com/omsimos/umamin/releases/tag/${version}`}
            target="_blank"
            title="Release Notes"
          >
            <Badge variant="outline">{version}</Badge>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {/* <PwaInstallButton /> */}
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
