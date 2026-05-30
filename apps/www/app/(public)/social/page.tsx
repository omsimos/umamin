import { cn } from "@umamin/ui/lib/utils";
import { redirect } from "next/navigation";
import { AnimatedShinyText } from "@/components/animated-shiny-text";

// /social is the maintenance fallback for the live feed: feed/page.tsx redirects
// here only when NEXT_PUBLIC_SOCIAL_UNDER_MAINTENANCE === "true". Otherwise the
// real feed is live, so send visitors there instead of showing a stale teaser.
export default function Social() {
  if (process.env.NEXT_PUBLIC_SOCIAL_UNDER_MAINTENANCE !== "true") {
    redirect("/feed");
  }

  return (
    <main className="pb-24">
      <div className="flex flex-col items-center container">
        <div
          className={cn(
            "group rounded-full border border-black/5 bg-zinc-100 text-base text-white transition-all ease-in dark:border-white/5 dark:bg-zinc-900",
          )}
        >
          <AnimatedShinyText className="inline-flex items-center justify-center px-4 py-1 transition ease-out">
            Coming Soon!
          </AnimatedShinyText>
        </div>

        <h1 className="font-extrabold md:text-7xl text-[10vw] leading-none dark:bg-gradient-to-b from-foreground dark:to-zinc-400 bg-zinc-800 bg-clip-text text-transparent tracking-tighter text-center mt-6">
          Umamin Social
        </h1>
      </div>
    </main>
  );
}
