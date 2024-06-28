import { AnimatedShinyText } from "@umamin/ui/components/animated-shiny-text";
import { Button } from "@umamin/ui/components/button";
import { cn } from "@umamin/ui/lib/utils";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex items-center flex-col min-h-screen lg:pt-44 py-36 md:gap-8 gap-6 container">
      <div
        className={cn(
          "group rounded-full border border-black/5 bg-zinc-100 text-base text-white transition-all ease-in dark:border-white/5 dark:bg-zinc-900"
        )}
      >
        <AnimatedShinyText className="inline-flex items-center justify-center px-4 py-1 transition ease-out">
          Error 404
        </AnimatedShinyText>
      </div>
      <div className="border-b-2 border-muted border-dashed md:pb-8 pb-6">
        <h1 className="font-extrabold md:text-7xl text-[10vw] leading-none dark:bg-gradient-to-b from-foreground dark:to-zinc-400 bg-clip-text bg-zinc-800 text-transparent tracking-tighter text-center">
          Oops, Page Not Found
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <Button size="lg" className="md:text-base" asChild>
          <Link href="/">Go Back</Link>
        </Button>
      </div>
    </main>
  );
}
