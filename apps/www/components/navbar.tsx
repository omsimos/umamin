"use client";

import { Badge } from "@umamin/ui/components/badge";
import { cn } from "@umamin/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isStandaloneMode } from "@/lib/pwa";
// import { PwaInstallButton } from "./pwa-install-button";
import { ThemeToggle } from "./theme-toggle";
import { UmaminLogo } from "./umamin-logo";

export function Navbar() {
  const pathname = usePathname();
  const version = process.env.NEXT_PUBLIC_VERSION ?? "v0.0.0";

  if (isStandaloneMode()) {
    return null;
  }

  // Post detail is a focused view with its own header (PostHeader) — hide the
  // global bar entirely on every breakpoint.
  if (pathname.startsWith("/post")) {
    return null;
  }

  // Feed surfaces use the mobile AppHeader; keep the desktop bar there.
  const feedSurface = pathname === "/feed" || pathname === "/notes";

  return (
    <nav
      className={cn(
        "fixed left-0 right-0 top-0 z-50 w-full bg-background bg-opacity-40 bg-clip-padding py-5 backdrop-blur-xl backdrop-filter lg:z-40",
        feedSurface && "max-lg:hidden",
      )}
    >
      <div className="container flex max-w-7xl justify-between items-center">
        <div className="space-x-2 flex items-center">
          <Link
            href="/"
            aria-label="umamin"
            className="flex items-center gap-1.5"
          >
            <UmaminLogo className="size-6" />
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
