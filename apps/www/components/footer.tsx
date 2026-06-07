"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Footer() {
  const pathname = usePathname();
  // The focused post view owns the bottom (reply bar) — skip the footer there.
  if (pathname.startsWith("/post")) {
    return null;
  }

  return (
    // mt clears the virtualized lists above: their height is the
    // virtualizer's estimate, which can briefly lag the real rows mid-scroll.
    <footer className="mt-16 pb-24 lg:pb-8 flex flex-col items-center text-muted-foreground text-sm">
      <div>
        <span>developed</span> by{" "}
        <Link
          className="underline font-medium"
          href="https://www.instagram.com/josh.xfi/"
          target="_blank"
        >
          @josh.xfi
        </Link>{" "}
        and{" "}
        <Link
          className="underline font-medium"
          href="https://github.com/omsimos/umamin/graphs/contributors"
          target="_blank"
        >
          contributors
        </Link>
      </div>
    </footer>
  );
}
