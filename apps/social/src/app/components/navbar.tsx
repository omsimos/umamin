import Link from "next/link";
import { logout } from "@/actions";
import { getSession } from "@/lib/auth";
import { SignOutButton } from "./sign-out-btn";
import { Button } from "@umamin/ui/components/button";

export async function Navbar() {
  const { session } = await getSession();

  return (
    <nav className="py-5 container md:px-0 flex justify-between items-center max-w-lg">
      <Link href="/" aria-label="logo">
        <span className="text-muted-foreground font-medium">social.</span>
        <span className="font-semibold text-foreground">umamin</span>
        <span className="text-muted-foreground font-medium">.link</span>
      </Link>

      {session ? (
        <form action={logout}>
          <SignOutButton />
        </form>
      ) : (
        <Button asChild type="submit" variant="outline">
          <Link href="/login">Login</Link>
        </Button>
      )}
    </nav>
  );
}
