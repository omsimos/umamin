import { createFileRoute, redirect } from "@tanstack/react-router";
import { cn } from "@umamin/ui/lib/utils";
import { AnimatedShinyText } from "@/components/animated-shiny-text";

// /social is the maintenance fallback for the live feed: it exists only when
// VITE_SOCIAL_UNDER_MAINTENANCE === "true" (feed/page redirects here in that
// case). Otherwise the real feed is live, so bounce visitors there. Ported from
// apps/www app/(public)/social/page.tsx (NEXT_PUBLIC_ → VITE_).
export const Route = createFileRoute("/_public/social")({
  beforeLoad: () => {
    if (import.meta.env.VITE_SOCIAL_UNDER_MAINTENANCE !== "true") {
      // `href` (not typed `to`) so this doesn't depend on the /feed route — it's
      // owned by another route group and may not be in the tree at typecheck.
      throw redirect({ href: "/feed" });
    }
  },
  component: Social,
});

function Social() {
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
