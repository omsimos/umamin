import Link from "next/link";
import { Badge } from "@umamin/ui/components/badge";
import {
  LinkIcon,
  LogIn,
  MessagesSquare,
  ScrollText,
  UserCog,
} from "lucide-react";

import { getSession } from "@/lib/auth";
import { Icons } from "./utilities/icons";
import { ToggleTheme } from "./utilities/toggle-theme";
import { ShareLinkDialog } from "./share-link-dialog";

export async function Navbar() {
  const { user } = await getSession();
  const version = process.env.NEXT_PUBLIC_VERSION
    ? process.env.NEXT_PUBLIC_VERSION
    : "v2.0.0";

  return (
    <nav>
      <div className="fixed left-0 right-0 top-0 z-50 w-full bg-background bg-opacity-40 bg-clip-padding py-5 backdrop-blur-xl backdrop-filter lg:z-40 container max-w-screen-xl">
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

          <div className="flex items-center">
            <ToggleTheme />
            {/* <BurgerMenu /> */}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 mx-auto flex max-w-screen-sm items-center justify-center gap-3 bg-bg bg-opacity-40 bg-clip-padding p-2 text-3xl backdrop-blur-xl backdrop-filter sm:px-10 lg:bottom-auto lg:top-0 lg:z-50 lg:bg-transparent lg:px-14 lg:text-[1.75rem] lg:backdrop-blur-none [&>*:hover]:bg-muted [&>*]:flex [&>*]:w-full [&>*]:justify-center [&>*]:rounded-lg [&>*]:py-5 [&>*]:text-center [&>*]:text-muted-foreground [&>*]:transition-colors [&>*]:duration-300">
        {user?.username ? (
          <ShareLinkDialog username={user?.username} />
        ) : (
          <Link href="/login">
            <LinkIcon className="h-6 w-6" />
          </Link>
        )}

        <Link data-testid="nav-notes-btn" href="/notes" title="Notes">
          <ScrollText className="h-6 w-6" />
        </Link>

        <Link
          data-testid="nav-inbox-btn"
          href={user ? "/inbox" : "/login"}
          aria-label="home button"
          title="Inbox"
        >
          <Icons.squares />
        </Link>

        <Link href="/social" title="Social">
          <MessagesSquare className="h-6 w-6" />
        </Link>

        {user ? (
          <Link
            data-testid="nav-settings-btn"
            href="/settings"
            title="Settings"
          >
            <UserCog className="w-6 h-6" />
          </Link>
        ) : (
          <Link data-testid="nav-login-btn" href="/login" title="Login">
            <LogIn className="h-6 w-6" />
          </Link>
        )}
      </div>
    </nav>
  );
}
