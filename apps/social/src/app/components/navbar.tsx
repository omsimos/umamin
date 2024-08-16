import Link from "next/link";
import Image from "next/image";
import { logout } from "@/actions";
import logo from "/public/logo.svg";
import { getSession } from "@/lib/auth";
import { SignOutButton } from "./sign-out-btn";
import { ArrowLeft, ScanFace } from "lucide-react";

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
    <nav className="py-3 container md:px-0 grid grid-cols-3 items-center w-full max-w-lg bg-opacity-95 bg-bg backdrop-blur-3xl fixed top-0 left-0 right-0 z-50">
      <Link href="/" aria-label="back">
        <ArrowLeft />
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
            <AvatarImage src={user?.imageUrl ?? undefined} alt="User avatar" />
            <AvatarFallback>
              <ScanFace />
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="font-semibold [&>*]:cursor-pointer [&>*]:border-b [&>*]:last:border-0 mr-4">
          <DropdownMenuItem>Profile</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
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
    </nav>
  );
}
