import { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export const AnimatedShinyText = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => {
  return (
    <p
      style={
        {
          "--shimmer-width": `${100}px`,
        } as CSSProperties
      }
      className={cn(
        "mx-auto max-w-md text-zinc-500/70 dark:text-zinc-100/50 ",
        className,

        // Shimmer effect
        "animate-shimmer bg-clip-text bg-no-repeat [background-position:0_0] [background-size:var(--shimmer-width)_100%] [transition:background-position_1s_cubic-bezier(.6,.6,0,1)_infinite]",

        // Shimmer gradient
        "bg-gradient-to-r from-transparent via-black/80 via-50% to-transparent  dark:via-white/80",

        "min-w-0 break-all text-right",
      )}
    >
      {children}
    </p>
  );
};
