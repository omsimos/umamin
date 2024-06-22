import Link from "next/link";
import { ExternalLink, Lock } from "lucide-react";

import { Demo } from "./components/demo";
import { Button } from "@umamin/ui/components/button";
import { AnimatedShinyText } from "@umamin/ui/components/animated-shiny-text";

export default async function Home() {
  return (
    <main className="flex items-center flex-col min-h-screen lg:pt-44 py-36 container">
      <Link
        href="https://v1.umamin.link"
        target="_blank"
        className="group rounded-full border text-sm text-white transition-all ease-in hover:cursor-pointer border-white/5 bg-neutral-900 hover:bg-neutral-800"
      >
        <AnimatedShinyText className="inline-flex items-center justify-center px-4 py-2 transition ease-out hover:text-neutral-600 hover:duration-300 hover:dark:text-neutral-400">
          <span>
            🧐 Looking for <span className="font-semibold">Umamin v1.0</span>?
          </span>
          <ExternalLink className="ml-1 size-3 transition-transform duration-300 ease-in-out group-hover:translate-x-0.5" />
        </AnimatedShinyText>
      </Link>

      <div className="border-b-2 border-muted border-dashed py-8">
        <h1 className="font-extrabold md:text-7xl text-[10vw] leading-none bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent tracking-tighter text-center">
          The Platform for Anonymity
        </h1>
      </div>

      <p className="text-muted-foreground mt-8 text-center md:text-xl max-w-2xl">
        Introducing our next generation platform for anonymous messages.{" "}
        <span className="text-white font-medium">v2.0</span> requires a new{" "}
        <Link href="/login" className="text-white underline font-medium">
          Umamin Account
        </Link>{" "}
        that can be used across the platform.
      </p>

      <div className="flex items-center gap-2 mt-8">
        <Button size="lg" className="md:text-base" asChild>
          <Link href="/login">Continue</Link>
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

      <div className="mt-4 text-muted-foreground text-sm flex items-center">
        <Lock className="h-4 w-4 mr-2" />
        All messages are automatically encrypted
        <Lock className="h-4 w-4 ml-2" />
      </div>
    </main>
  );
}
