import {
  CircleUserRoundIcon,
  LayoutDashboardIcon,
  LogInIcon,
  MessagesSquareIcon,
  ScrollTextIcon,
} from "lucide-react";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { ChatPromo } from "./chat-promo";
import { MenubarLink } from "./menubar-link";
import { NavNotifications } from "./nav-notifications";

export async function Menubar() {
  const { user, session } = await getSession();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 mx-auto flex max-w-screen-sm items-center justify-center gap-3 bg-bg bg-opacity-40 bg-clip-padding p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-3xl backdrop-blur-xl backdrop-filter sm:px-10 lg:bottom-auto lg:top-0 lg:z-50 lg:bg-transparent lg:px-14 lg:pb-2 lg:text-[1.75rem] lg:backdrop-blur-none [&>*:hover]:bg-muted *:flex *:w-full *:justify-center *:rounded-lg *:py-5 *:text-center *:text-muted-foreground *:transition-colors *:duration-300">
      <ChatPromo />

      <MenubarLink href="/notes" title="Notes">
        <ScrollTextIcon className="h-6 w-6" />
      </MenubarLink>

      {user?.username ? (
        // Lands on the profile's Posts tab; Received/Sent are one tap away.
        <MenubarLink
          href={`/user/${user.username}`}
          ariaLabel="Your profile"
          title="Profile"
        >
          <CircleUserRoundIcon className="h-6 w-6" />
        </MenubarLink>
      ) : (
        <Link href="/login" aria-label="Login" title="Login">
          <LayoutDashboardIcon />
        </Link>
      )}

      <MenubarLink href="/feed" title="Social">
        <MessagesSquareIcon className="h-6 w-6" />
      </MenubarLink>

      {session ? (
        <NavNotifications />
      ) : (
        <Link href="/login" title="Login">
          <LogInIcon className="h-6 w-6" />
        </Link>
      )}
    </div>
  );
}
