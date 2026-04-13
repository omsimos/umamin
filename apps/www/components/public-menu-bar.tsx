import {
  LayoutDashboardIcon,
  LinkIcon,
  LogInIcon,
  MessagesSquareIcon,
  ScrollTextIcon,
} from "lucide-react";
import Link from "next/link";

export function PublicMenubar() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 mx-auto flex max-w-screen-sm items-center justify-center gap-3 bg-bg bg-opacity-40 bg-clip-padding p-2 text-3xl backdrop-blur-xl backdrop-filter sm:px-10 lg:bottom-auto lg:top-0 lg:z-50 lg:bg-transparent lg:px-14 lg:text-[1.75rem] lg:backdrop-blur-none [&>*:hover]:bg-muted *:flex *:w-full *:justify-center *:rounded-lg *:py-5 *:text-center *:text-muted-foreground *:transition-colors *:duration-300">
      <Link href="/login" title="Share Link">
        <LinkIcon className="h-6 w-6" />
      </Link>

      <Link href="/notes" title="Notes">
        <ScrollTextIcon className="h-6 w-6" />
      </Link>

      <Link href="/login" aria-label="home button" title="Inbox">
        <LayoutDashboardIcon />
      </Link>

      <Link href="/feed" title="Social">
        <MessagesSquareIcon className="h-6 w-6" />
      </Link>

      <Link href="/login" title="Login">
        <LogInIcon className="h-6 w-6" />
      </Link>
    </div>
  );
}
