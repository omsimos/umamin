import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { Demo } from "./components/demo";
import { Button } from "@umamin/ui/components/button";
import { AnimatedShinyText } from "@umamin/ui/components/animated-shiny-text";
import { cn } from "@umamin/ui/lib/utils";

export default async function Home() {
  return (
    <main className="flex items-center flex-col min-h-screen lg:pt-44 py-36 md:gap-8 gap-6 container">
      <Link
        href="https://v1.umamin.link"
        target="_blank"
        className={cn(
          "group rounded-full border border-black/5 bg-zinc-100 text-base text-white transition-all ease-in hover:cursor-pointer hover:bg-zinc-200 dark:border-white/5 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        )}
      >
        <AnimatedShinyText className="inline-flex items-center justify-center px-4 py-1 transition ease-out hover:text-zinc-300 hover:duration-300 hover:dark:text-zinc-400">
          <span>
            Looking for <span className="font-semibold">Umamin v1.0</span>?
          </span>
          <ExternalLink className="ml-1 size-3 transition-transform duration-300 ease-in-out group-hover:translate-x-0.5" />
        </AnimatedShinyText>
      </Link>

      <div className="border-b-2 border-muted border-dashed md:pb-8 pb-6">
        <h1 className="font-extrabold md:text-7xl text-[10vw] leading-none dark:bg-gradient-to-b from-foreground dark:to-zinc-400 bg-clip-text bg-zinc-800 text-transparent tracking-tighter text-center">
          The Platform for Anonymity
        </h1>
      </div>

      <p className="text-muted-foreground text-center md:text-xl max-w-2xl">
        Next generation open-source platform for sending and receiving encrypted
        anonymous messages.{" "}
        <span className="text-foreground font-medium">Umamin v2.0</span>{" "}
        requires a new account that can be used across the platform.
      </p>

      <div className="flex items-center gap-2">
        <Button size="lg" className="md:text-base" asChild>
          <Link href="/register">Continue</Link>
        </Button>

        <Button
          variant="outline"
          size="lg"
          asChild
          className="w-full lg:text-base"
        >
          <Link href="/social">Umamin Social</Link>
        </Button>
      </div>

      <Demo />
    </main>
  );
}
