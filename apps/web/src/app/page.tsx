import Link from "next/link";
import { cn } from "@ui/lib/utils";
import { Button, buttonVariants } from "@ui/components/ui/button";

export default function Home() {
  return (
    <main className="h-screen flex items-center justify-center flex-col max-w-screen-sm mx-auto container">
      <h1 className="font-bold text-6xl bg-gradient-to-br from-zinc-200 to-zinc-700 bg-clip-text text-transparent">
        Umamin v2
      </h1>
      <p className="text-muted-foreground mt-4 text-center text-sm">
        Next generation platform for anonymous messages. Create an Umamin
        Account and use it across Umamin platforms including Umamin Q&amp;A,
        Umamin Social, and more.
      </p>

      <div className="flex items-center gap-2 mt-8">
        <Link
          href="/login"
          className={cn(
            buttonVariants({
              variant: "outline",
            }),
            "w-full",
          )}
        >
          Continue
        </Link>

        <Button variant="outline" className="w-full" disabled>
          Umamin Social
        </Button>
      </div>
    </main>
  );
}
