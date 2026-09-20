import { cn } from "@umamin/ui/lib/utils";
import { Link, usePathname } from "@/lib/navigation";
import { AccountSheet } from "./account-sheet";
import { UmaminLogo } from "./umamin-logo";

// Hidden in the installed app via the `standalone:` CSS variant rather than a
// render-time check: the server can't know the display mode, so branching in
// render mismatched hydration for every PWA user (React #418).
export function Navbar() {
  const pathname = usePathname();

  // Post detail is a focused view on every breakpoint (its own PostHeader).
  if (pathname.startsWith("/post")) {
    return null;
  }

  // These surfaces use a mobile top bar (AppHeader avatar, or BackHeader on the
  // secondary pages); keep the desktop bar there but step aside on mobile so
  // the two don't stack.
  const mobileHeaderSurface =
    pathname === "/feed" ||
    pathname === "/notes" ||
    pathname === "/inbox" ||
    pathname === "/notifications" ||
    pathname === "/settings" ||
    pathname === "/tiers" ||
    pathname.startsWith("/groups") ||
    pathname.startsWith("/user/");

  return (
    <nav
      className={cn(
        "fixed left-0 right-0 top-0 z-50 w-full bg-background/80 bg-clip-padding py-5 backdrop-blur-xl backdrop-filter standalone:hidden lg:z-40",
        mobileHeaderSurface && "max-lg:hidden",
      )}
    >
      <div className="container flex max-w-7xl justify-between items-center">
        <Link
          href="/"
          aria-label="umamin"
          className="flex items-center gap-1.5"
        >
          <UmaminLogo className="size-6" />
        </Link>

        <AccountSheet avatarClassName="size-8" />
      </div>
    </nav>
  );
}
