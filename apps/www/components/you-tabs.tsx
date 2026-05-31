import { cn } from "@umamin/ui/lib/utils";
import Link from "next/link";

type YouTabsProps = {
  username: string;
  active: "posts" | "messages";
};

// Primary "Posts | Messages" section nav shown only on your own surfaces. Light
// underline tabs (not a filled bar) so it reads as navigation and doesn't
// compete with buttons above or sub-tabs below. The tabs are route-switching
// links: Posts -> public profile, Messages -> private inbox — keeping posts
// public/cached and messages private/auth-gated while feeling like one surface.
export function YouTabs({ username, active }: YouTabsProps) {
  const tab =
    "flex-1 border-b-2 px-2 pb-2.5 text-center text-sm font-semibold transition-colors";
  const activeTab = "border-foreground text-foreground";
  const inactiveTab =
    "border-transparent text-muted-foreground hover:text-foreground";

  return (
    <nav className="mt-6 flex w-full border-b">
      <Link
        href={`/user/${username}`}
        aria-current={active === "posts" ? "page" : undefined}
        className={cn(tab, active === "posts" ? activeTab : inactiveTab)}
      >
        Posts
      </Link>
      <Link
        href="/inbox"
        aria-current={active === "messages" ? "page" : undefined}
        className={cn(tab, active === "messages" ? activeTab : inactiveTab)}
      >
        Messages
      </Link>
    </nav>
  );
}
