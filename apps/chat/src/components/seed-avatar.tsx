import { cn } from "@umamin/ui/lib/utils";
import { useMemo } from "react";
import { avatarDataUri, avatarGradient } from "../lib/avatar";

export function SeedAvatar({
  seed,
  alias,
  className,
}: {
  seed: string;
  alias: string;
  className?: string;
}) {
  const src = useMemo(() => avatarDataUri(seed), [seed]);
  return (
    <span
      role="img"
      aria-label={alias}
      style={avatarGradient(seed)}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full select-none",
        className,
      )}
    >
      <img src={src} alt="" aria-hidden className="size-full" />
    </span>
  );
}
