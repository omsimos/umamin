import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { cn } from "@umamin/ui/lib/utils";
import { AnimatedShinyText } from "@umamin/ui/components/animated-shiny-text";

export function V1Link({ className }: { className?: string }) {
  return (
    <Link
      href="https://v1.umamin.link"
      target="_blank"
      className={cn(
        "group rounded-full border border-black/5 bg-zinc-100 text-base text-white transition-all ease-in hover:cursor-pointer hover:bg-zinc-200 dark:border-white/5 dark:bg-zinc-900 dark:hover:bg-zinc-800",
        className,
      )}
    >
      <AnimatedShinyText className="inline-flex items-center justify-center px-4 py-1 transition ease-out hover:text-zinc-300 hover:duration-300 hover:dark:text-zinc-400">
        <span>
          Looking for <span className="font-semibold">Umamin v1.0</span>?
        </span>
        <ExternalLink className="ml-1 size-3 transition-transform duration-300 ease-in-out group-hover:translate-x-0.5" />
      </AnimatedShinyText>
    </Link>
  );
}
