import Link from "next/link";
import Image from "next/image";
import { logout } from "@/actions";
import logo from "/public/logo.svg";
import { getSession } from "@/lib/auth";
import { SignOutButton } from "./sign-out-btn";
import {
  ArrowLeft,
  LinkIcon,
  LogIn,
  MessagesSquare,
  ScanFace,
  ScrollText,
  UserCog,
} from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";

import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@umamin/ui/components/dropdown-menu";

export async function Navbar() {
  const { user, session } = await getSession();

  return (
    <>
      <nav className="md:px-0 bg-background/95 backdrop-blur-3xl fixed top-0 left-0 right-0 z-50">
        <div className="py-3 w-full max-w-lg grid grid-cols-3 items-center container">
          <Link href="/" aria-label="back">
            <ArrowLeft className="text-zinc-300" />
          </Link>
          <Link
            href="/"
            aria-label="logo"
            className="place-self-center text-[10vw] leading-none dark:bg-gradient-to-b from-foreground dark:to-zinc-400 bg-clip-text bg-zinc-800 text-transparent tracking-tighter text-center"
          >
            <Image src={logo} alt="logo" height={50} />
          </Link>

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              title="post menu"
              className="place-self-end self-center"
            >
              <Avatar>
                <AvatarImage
                  src={user?.imageUrl ?? undefined}
                  alt="User avatar"
                />
                <AvatarFallback>
                  <ScanFace />
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="font-semibold [&>*]:cursor-pointer [&>*]:border-b [&>*]:last:border-0 mr-4">
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                {session ? (
                  <form action={logout} className="place-self-end">
                    <SignOutButton />
                  </form>
                ) : (
                  <Link href="/login" className="place-self-end">
                    Login
                  </Link>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>

      <div className="fixed bottom-0 left-0 right-0 z-40 mx-auto flex max-w-screen-sm items-center justify-center gap-3 bg-bg bg-opacity-40 bg-clip-padding p-2 text-3xl backdrop-blur-xl backdrop-filter sm:px-10 lg:z-50 lg:bg-transparent lg:px-14 lg:text-[1.75rem] [&>*:hover]:bg-muted [&>*]:flex [&>*]:w-full [&>*]:justify-center [&>*]:rounded-lg [&>*]:py-5 [&>*]:text-center [&>*]:text-muted-foreground [&>*]:transition-colors [&>*]:duration-300">
        <Link href="/login">
          <LinkIcon className="h-6 w-6" />
        </Link>

        <Link data-testid="nav-notes-btn" href="/notes" title="Notes">
          <ScrollText className="h-6 w-6" />
        </Link>

        <Link
          data-testid="nav-inbox-btn"
          href={user ? "/inbox" : "/login"}
          aria-label="home button"
          title="Inbox"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-6 h-6"
          >
            <path
              fillRule="evenodd"
              d="M3 6a3 3 0 0 1 3-3h2.25a3 3 0 0 1 3 3v2.25a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Zm9.75 0a3 3 0 0 1 3-3H18a3 3 0 0 1 3 3v2.25a3 3 0 0 1-3 3h-2.25a3 3 0 0 1-3-3V6ZM3 15.75a3 3 0 0 1 3-3h2.25a3 3 0 0 1 3 3V18a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-2.25Zm9.75 0a3 3 0 0 1 3-3H18a3 3 0 0 1 3 3V18a3 3 0 0 1-3 3h-2.25a3 3 0 0 1-3-3v-2.25Z"
              clipRule="evenodd"
            />
          </svg>
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
    </>
  );
}
