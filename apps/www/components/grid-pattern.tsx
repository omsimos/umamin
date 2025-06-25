import { cn } from "@/lib/utils";
import { useId } from "react";

export function GridPattern() {
  const id = useId();

  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full fill-gray-400/20 dark:stroke-foreground/10 stroke-foreground/20 xl:[mask-image:radial-gradient(circle_at_center,white,transparent_60%)] [mask-image:radial-gradient(circle_at_center,white,transparent)] md:[mask-image:radial-gradient(circle_at_center,white,transparent_80%)] ",
        "border dark:border-foreground/10 border-foreground/20 z-[-1]",
      )}
    >
      <defs>
        <pattern
          id={id}
          width={40}
          height={40}
          patternUnits="userSpaceOnUse"
          x={-1}
          y={-1}
        >
          <path d={`M.5 ${40}V.5H${40}`} fill="none" strokeDasharray={0} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill={`url(#${id})`} />
    </svg>
  );
}
