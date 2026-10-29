import { Blobatar } from "@blobatar/react";
import { cn } from "@umamin/ui/lib/utils";
import "blobatar/motion.css";
import type { Expression } from "blobatar/expression";
import { useMemo } from "react";
import { avatarDataUri } from "../lib/avatar";

export function SeedAvatar({
  seed,
  alias,
  expression,
  className,
}: {
  seed: string;
  alias: string;
  /** Animates the face into this expression. Inline SVG instead of an <img>,
   *  so keep it to the one or two faces on screen that are doing something. */
  expression?: Expression;
  className?: string;
}) {
  const src = useMemo(() => avatarDataUri(seed), [seed]);
  return (
    <span
      role="img"
      aria-label={alias}
      className={cn(
        "bg-muted inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full select-none",
        className,
      )}
    >
      {expression ? (
        <Blobatar
          name={seed}
          animate="always"
          expression={expression}
          aria-hidden="true"
          className="size-full"
        />
      ) : (
        <img src={src} alt="" aria-hidden className="size-full" />
      )}
    </span>
  );
}
