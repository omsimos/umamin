import { cn } from "@umamin/ui/lib/utils";
import { avatarGradient, initialOf } from "../lib/avatar";

export function SeedAvatar({
  seed,
  alias,
  className,
}: {
  seed: string;
  alias: string;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={alias}
      style={avatarGradient(seed)}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white select-none",
        className,
      )}
    >
      {initialOf(alias)}
    </span>
  );
}
