import { Button } from "@umamin/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@umamin/ui/components/drawer";
import { Menu } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "../logo";

function Wordmark() {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-bold">
      <Logo className="text-primary size-5" />
      umamin
    </span>
  );
}

/**
 * Two-pane app frame. On desktop the rail is a fixed left column; on mobile it
 * collapses behind a hamburger that opens a bottom Drawer. Page content is the
 * children; per-conversation chrome (partner header) lives inside children.
 */
export function AppShell({
  rail,
  children,
}: {
  rail: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="bg-background text-foreground flex h-svh overflow-hidden">
      <aside className="hidden w-64 shrink-0 flex-col border-r p-4 lg:flex">
        {rail}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b px-3 py-2 lg:hidden">
          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu />
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerTitle className="sr-only">Menu</DrawerTitle>
              <DrawerDescription className="sr-only">
                Your identity and session controls
              </DrawerDescription>
              <div className="flex flex-col gap-3 p-4">{rail}</div>
            </DrawerContent>
          </Drawer>
          <Wordmark />
        </header>

        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}

export { Wordmark };
