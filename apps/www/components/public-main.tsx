"use client";

import { usePathname } from "next/navigation";

// The feed surfaces show the compact AppHeader (h-16); every other public page
// shows the taller default Navbar. Pad the content area to clear whichever fixed
// header is active so the content doesn't start with a large empty gap.
const COMPACT_ROUTES = new Set(["/feed", "/notes"]);

export function PublicMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const compact = COMPACT_ROUTES.has(pathname);

  return <div className={compact ? "pt-16" : "pt-24"}>{children}</div>;
}
