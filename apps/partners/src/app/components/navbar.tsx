import Link from "next/link";
import { logout } from "@umamin/shared/actions";
import { SignOutButton } from "./sign-out-btn";
import { Badge } from "@umamin/ui/components/badge";

export function Navbar() {
  return (
    <nav className="fixed left-0 right-0 top-0 z-50 w-full bg-background bg-opacity-40 bg-clip-padding py-5 backdrop-blur-xl backdrop-filter lg:z-40 container max-w-screen-2xl flex justify-between items-center">
      <div className="space-x-2 flex items-center">
        <Link href="/" aria-label="logo">
          <span className="text-muted-foreground font-medium">partners.</span>
          <span className="font-semibold text-foreground">umamin</span>
          <span className="text-muted-foreground font-medium">.link</span>
        </Link>

        <Badge variant="outline">beta</Badge>
      </div>

      <form action={logout}>
        <SignOutButton />
      </form>
    </nav>
  );
}
