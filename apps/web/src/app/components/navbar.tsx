import Link from "next/link";
import { Badge } from "@umamin/ui/components/badge";
import { LinkIcon, LogIn, MessagesSquare, ScrollText } from "lucide-react";

import { getSession } from "@/lib/auth";
import { Icons } from "./utilities/icons";
// import { BurgerMenu } from "./burger-menu";
import { ToggleTheme } from "./utilities/toggle-theme";
import { SettingsDrawer } from "./dialog/settings-drawer";
import { ShareLinkDialog } from "./dialog/share-link-dialog";

export async function Navbar() {
  const { user } = await getSession();

  return (
    <nav className="">
      <div className="fixed left-0 right-0 top-0 z-50 w-full bg-background bg-opacity-40 bg-clip-padding py-5 backdrop-blur-xl backdrop-filter lg:z-40 container max-w-screen-xl">
        <div className="flex justify-between items-center">
          <div className="space-x-2 flex items-center">
            <Link href="/" aria-label="logo">
              <span className="font-semibold text-foreground">umamin</span>
              <span className="text-muted-foreground font-medium">.link</span>
            </Link>

            <Badge variant="outline">v2-beta</Badge>
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

        <Link href="/notes">
          <ScrollText className="h-6 w-6" />
        </Link>

        <Link href={user ? "/inbox" : "/login"} aria-label="home button">
          <Icons.squares />
        </Link>

        <Link href="/">
          <MessagesSquare className="h-6 w-6" />
        </Link>

        {user ? (
          <SettingsDrawer user={user} />
        ) : (
          <Link href="/login">
            <LogIn className="h-6 w-6" />
          </Link>
        )}
      </div>
    </nav>
  );
}
