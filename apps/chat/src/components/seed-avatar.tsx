import { loreleiNeutral, notionistsNeutral } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";
import { cn } from "@umamin/ui/lib/utils";
import { useMemo } from "react";
import { avatarGradient, seedIndex } from "../lib/avatar";

export function SeedAvatar({
  seed,
  alias,
  className,
}: {
  seed: string;
  alias: string;
  className?: string;
}) {
  const src = useMemo(
    () =>
      seedIndex(seed, 2) === 0
        ? createAvatar(notionistsNeutral, { seed }).toDataUri()
        : createAvatar(loreleiNeutral, { seed }).toDataUri(),
    [seed],
  );
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
