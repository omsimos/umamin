import { Button } from "@umamin/ui/components/button";
import { LogOutIcon, SettingsIcon } from "lucide-react";
import Link from "next/link";
import { logout } from "@/lib/auth";
import { CopyLinkButton } from "./copy-link-button";

export function AppHeader({
  username,
  displayName,
}: {
  username: string;
  displayName: string | null;
}) {
  return (
    <header className="bg-background/80 sticky top-0 z-20 border-b backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 lg:px-6">
        <Link href="/dashboard" className="font-display truncate font-semibold">
          {displayName || `@${username}`}
        </Link>

        <nav className="flex items-center gap-1">
          <CopyLinkButton username={username} />
          <Button asChild variant="ghost" size="icon" aria-label="Settings">
            <Link href="/settings">
              <SettingsIcon />
            </Link>
          </Button>
          <form action={logout}>
            <Button
              variant="ghost"
              size="icon"
              type="submit"
              aria-label="Sign out"
            >
              <LogOutIcon />
            </Button>
          </form>
        </nav>
      </div>
    </header>
  );
}
