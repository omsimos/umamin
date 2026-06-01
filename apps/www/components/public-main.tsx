"use client";

import { usePathname } from "next/navigation";

// Clears the compact AppHeader (h-16) here vs the taller Navbar elsewhere.
const COMPACT_ROUTES = new Set(["/feed", "/notes"]);

export function PublicMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const compact = COMPACT_ROUTES.has(pathname);

  return <div className={compact ? "pt-16" : "pt-24"}>{children}</div>;
}
