import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@umamin/ui/components/sheet";
import { Icons } from "./utilities/icons";
import { Button } from "@umamin/ui/components/button";

export function BurgerMenu() {
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
