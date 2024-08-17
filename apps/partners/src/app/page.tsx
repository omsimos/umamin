import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { cn } from "@umamin/ui/lib/utils";
import { Button } from "@umamin/ui/components/button";
import { AnimatedShinyText } from "@umamin/ui/components/animated-shiny-text";
import GridPattern from "./components/grid-pattern";

export default function Home() {
  return (
    <main className="flex items-center flex-col min-h-screen lg:pt-44 py-36 md:gap-8 gap-6 container">
      <GridPattern className="[mask-image:radial-gradient(ellipse_at_center,white,transparent_60%)]" />
      <Link
        href="#"
        className={cn(
          "group rounded-full border border-black/5 bg-zinc-100 text-base text-white transition-all ease-in hover:cursor-pointer hover:bg-zinc-200 dark:border-white/5 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        )}
      >
        <AnimatedShinyText className="inline-flex items-center justify-center px-4 py-1 transition ease-out hover:text-zinc-300 hover:duration-300 hover:dark:text-zinc-400">
          <span>Become an Umamin Partner</span>
          <ExternalLink className="ml-1 size-3 transition-transform duration-300 ease-in-out group-hover:translate-x-0.5" />
        </AnimatedShinyText>
      </Link>

      <div className="relative z-[-1] flex place-items-center before:absolute before:h-[300px] before:w-full before:-translate-x-1/2 before:rounded-full before:bg-gradient-radial before:from-white before:to-transparent before:blur-2xl before:content-[''] after:absolute after:-z-20 after:h-[180px] after:w-full after:translate-x-1/3 after:bg-gradient-conic after:from-sky-200 after:via-blue-200 after:blur-2xl after:content-[''] before:dark:bg-gradient-to-br before:dark:from-transparent before:dark:to-blue-700 before:dark:opacity-10 after:dark:from-sky-900 after:dark:via-[#0141ff] after:dark:opacity-40 sm:before:w-[480px] sm:after:w-[240px] before:lg:h-[360px] border-b-2 border-muted border-dashed md:pb-8 pb-6">
        <h1 className="font-extrabold md:text-7xl max-w-2xl text-[10vw] leading-none dark:bg-gradient-to-b from-foreground dark:to-zinc-400 bg-clip-text bg-zinc-800 text-transparent tracking-tighter text-center">
          Powerful Tools for Anonymity at Scale
        </h1>
      </div>

      <p className="text-muted-foreground text-center md:text-xl max-w-2xl">
        Effortlessly manage large volumes of anonymous feedback, surveys, and
        communications with Umamin Partners. Tailored for businesses,
        organizations, and individuals.
      </p>

      <div className="flex items-center gap-2">
        <Button size="lg" className="md:text-base" asChild>
          <Link href="/login">Continue</Link>
        </Button>

        <Button
          variant="outline"
          size="lg"
          asChild
          className="w-full lg:text-base"
        >
          <Link href="#">Umamin Partners</Link>
        </Button>
      </div>
    </main>
  );
}
