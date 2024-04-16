"use client";

import Link from "next/link";
import { Icons } from "./utilities/icons";
import { ToggleTheme } from "./utilities/toggle-theme";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@umamin/ui/components/sheet";
import { Button } from "@umamin/ui/components/button";
import { ShareLinkDialog } from "./dialog/share-link-dialog";
import { SignOutDialog } from "./dialog/sign-out-dialog";
import { SettingsDrawer } from "./dialog/settings-drawer";
import { ActivityIcon } from "lucide-react";

export function Navbar() {
  return (
    <nav>
      <div className='fixed left-0 right-0 top-0 z-50 w-full bg-background bg-opacity-40 bg-clip-padding py-5 backdrop-blur-xl backdrop-filter md:z-40'>
        <div className='mx-auto grid w-full max-w-screen-xl grid-cols-3 items-center'>
          <Link
            href='/'
            aria-label='logo'
            className='col-start-2 place-self-center  md:col-start-1 md:ml-7 md:place-self-start'
          >
            <span className='font-semibold text-foreground'>umamin</span>
            <span className='text-muted-foreground font-medium'>.link</span>
          </Link>

          <div className='col-start-3 mr-7 place-self-end self-center flex items-center'>
            <ToggleTheme />
            <BurgerMenu />
          </div>
        </div>
      </div>

      <div className='fixed bottom-0 left-0 right-0 z-40 mx-auto flex max-w-screen-sm items-center justify-center gap-3 bg-bg bg-opacity-40 bg-clip-padding p-2 text-3xl backdrop-blur-xl backdrop-filter sm:px-10 md:bottom-auto md:top-0 md:z-50 md:bg-transparent md:px-14 md:text-[1.75rem] md:backdrop-blur-none [&>*:hover]:bg-muted [&>*]:flex [&>*]:w-full [&>*]:justify-center [&>*]:rounded-lg [&>*]:py-5 [&>*]:text-center [&>*]:text-muted-foreground [&>*]:transition-colors [&>*]:duration-300'>
        <ShareLinkDialog />

        <Link href='/pulse'>
          <ActivityIcon />
        </Link>

        <Link href='/user/johndoe' aria-label='home button'>
          <Icons.squares />
        </Link>

        <SettingsDrawer />

        <SignOutDialog />
      </div>
    </nav>
  );
}

const BurgerMenu = () => {
  return (
    <Sheet>
      <SheetTrigger
        asChild
        title='menu'
        className='text-3xl text-muted-foreground md:text-[1.75rem]'
      >
        <Button variant='ghost' size='icon'>
          <Icons.bars />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Logged in as John Doe</SheetTitle>
          <SheetDescription>
            Social Media application, built with modern technologies.
          </SheetDescription>
        </SheetHeader>
        <SheetTrigger className='mt-5 w-full'>
          <Button className='w-full'>{true ? "Sign out" : "Sign in"}</Button>
        </SheetTrigger>
        Announcements: 🎉 Huge update coming to Umamin Global!
      </SheetContent>
    </Sheet>
  );
};
