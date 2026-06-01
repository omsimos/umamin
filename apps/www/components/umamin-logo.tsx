import { cn } from "@umamin/ui/lib/utils";

// The source SVG is fill=white, so render it as a mask over bg-foreground — it
// then picks up the theme foreground color in both light and dark. Size it with
// a `size-*` class on `className`.
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
