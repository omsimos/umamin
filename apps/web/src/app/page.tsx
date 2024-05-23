import Link from "next/link";
import { cn } from "@ui/lib/utils";
import { Button, buttonVariants } from "@ui/components/ui/button";
import { ExternalLink } from "lucide-react";

export default function Home() {
  return (
    <main className="flex items-center flex-col lg:pt-56 pt-36 container">
      <Link
        className="flex items-center space-x-2 rounded-full bg-gradient-to-b from-zinc-800 to-zinc-900 mb-8 text-sm px-4 py-2"
        href="https://v1.umamin.link"
        target="_blank"
      >
        <p className="text-muted-foreground">Looking for <span className="font-semibold">Umamin v1.0</span>?</p>
        <ExternalLink className="w-4 h-4" />
      </Link>

      <div className="border-y-2 border-muted border-dashed py-8">
        <h1 className="font-extrabold md:text-7xl text-[10vw] leading-none bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent tracking-tighter text-center">
          The Platform for Anonymity
        </h1>
      </div>

      <p className="text-muted-foreground mt-8 text-center md:text-xl max-w-2xl">
        Introducing our next generation platform for anonymous messages.{" "}
        <span className="text-white font-medium">Umamin v2.0</span> requires a
        new{" "}
        <span className="text-white underline font-medium">Umamin Account</span>{" "}
        that can be used across the platform. Currently under beta release.
      </p>

      <div className="flex items-center gap-2 mt-8">
        <Link
          href="/login"
          className={cn(buttonVariants({ size: "lg" }), "md:text-base")}
        >
          Continue
        </Link>

        <Button
          variant="outline"
          size="lg"
          className="w-full lg:text-base"
          disabled
        >
          Umamin Social
        </Button>
      </div>
    </main>
  );
}
