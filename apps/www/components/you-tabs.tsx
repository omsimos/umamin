import { cn } from "@umamin/ui/lib/utils";
import Link from "next/link";

type YouTabsProps = {
  username: string;
  active: "posts" | "messages";
};

// Route-switching tabs: Posts -> public profile, Messages -> private inbox —
// keeps posts cached/public and messages private/auth-gated as one surface.
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
