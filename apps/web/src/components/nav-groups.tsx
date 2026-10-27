import { cn } from "@umamin/ui/lib/utils";
import { UsersRoundIcon } from "lucide-react";
import { Link, usePathname } from "@/lib/navigation";

// Bottom-nav Groups entry, shown while the Chat tab isn't launched.
export function NavGroups() {
  const pathname = usePathname();
  const active = pathname === "/groups" || pathname.startsWith("/groups/");

  return (
    <Link
      href="/groups"
      title="Groups"
      aria-current={active ? "page" : undefined}
      aria-label="Groups"
      className={cn(active && "text-foreground!")}
    >
      <UsersRoundIcon className="h-6 w-6" />
    </Link>
  );
}
