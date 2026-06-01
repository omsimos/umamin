import { cn } from "@umamin/ui/lib/utils";

// Source SVG is fill=white; rendered as a mask over bg-foreground so it themes.
export function UmaminLogo({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("block bg-foreground", className)}
      style={{
        maskImage: "url(/umamin-logo.svg)",
        WebkitMaskImage: "url(/umamin-logo.svg)",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        maskSize: "contain",
        WebkitMaskSize: "contain",
      }}
    />
  );
}
