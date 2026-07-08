import { Button } from "@umamin/ui/components/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-display text-3xl font-semibold">Not found</h1>
      <p className="text-muted-foreground text-sm">
        This page or organization doesn't exist.
      </p>
      <Button asChild variant="outline">
        <Link href="/login">Go to sign in</Link>
      </Button>
    </main>
  );
}
