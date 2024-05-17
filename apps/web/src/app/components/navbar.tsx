import Link from "next/link";
import { ActivityIcon, Globe, LogIn } from "lucide-react";

import { getSession } from "@/lib/auth";
import { Icons } from "./utilities/icons";
import { BurgerMenu } from "./burger-menu";
import { ToggleTheme } from "./utilities/toggle-theme";
import { SettingsDrawer } from "./dialog/settings-drawer";
import { ShareLinkDialog } from "./dialog/share-link-dialog";

export async function Navbar() {
  const { user } = await getSession();

  return (
    <nav>
      <div className="fixed left-0 right-0 top-0 z-50 w-full bg-background bg-opacity-40 bg-clip-padding py-5 backdrop-blur-xl backdrop-filter md:z-40">
        <div className="mx-auto grid w-full max-w-screen-xl grid-cols-3 items-center">
          <Link
            href="/"
            aria-label="logo"
            className="col-start-2 place-self-center  md:col-start-1 md:ml-7 md:place-self-start"
          >
            <span className="font-semibold text-foreground">umamin</span>
            <span className="text-muted-foreground font-medium">.link</span>
          </Link>

          <div className="col-start-3 mr-7 place-self-end self-center flex items-center">
            <ToggleTheme />
            <BurgerMenu />
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 mx-auto flex max-w-screen-sm items-center justify-center gap-3 bg-bg bg-opacity-40 bg-clip-padding p-2 text-3xl backdrop-blur-xl backdrop-filter sm:px-10 md:bottom-auto md:top-0 md:z-50 md:bg-transparent md:px-14 md:text-[1.75rem] md:backdrop-blur-none [&>*:hover]:bg-muted [&>*]:flex [&>*]:w-full [&>*]:justify-center [&>*]:rounded-lg [&>*]:py-5 [&>*]:text-center [&>*]:text-muted-foreground [&>*]:transition-colors [&>*]:duration-300">
        {user?.username ? (
          <ShareLinkDialog username={user?.username} />
        ) : (
          <Link href="/login">
            <Icons.link className="h-6" />
          </Link>
        )}

        <Link href="/notes">
          <ActivityIcon />
        </Link>

        <Link href={user ? "/inbox" : "/login"} aria-label="home button">
          <Icons.squares />
        </Link>

        <Link href="/">
          <Globe className="h-5 w-5" />
        </Link>

        {user ? (
          <SettingsDrawer user={user} />
        ) : (
          <Link href="/login">
            <LogIn className="h-4 w-4" />
          </Link>
        )}
      </div>
    </nav>
  );
}
