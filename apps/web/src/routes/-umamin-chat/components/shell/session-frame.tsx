import { Button } from "@umamin/ui/components/button";
import { cn } from "@umamin/ui/lib/utils";
import { ArrowLeftIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

/**
 * The session's full-screen column: edge to edge on
 * mobile, a bordered max-w-2xl column on desktop. It insets the notch and
 * side safe areas itself, since there's no app chrome around it; the composer
 * owns the bottom inset.
 */
export function SessionFrame({
  header,
  children,
}: {
  header: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="bg-background fixed inset-0 z-50">
      <div className="mx-auto flex h-full w-full flex-col pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] lg:max-w-2xl lg:border-x">
        {header}
        <main className="relative flex min-h-0 flex-1 flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}

export function SessionHeader({
  className,
  children,
  ...props
}: ComponentProps<"header">) {
  return (
    <header
      className={cn(
        "flex min-h-14 shrink-0 items-center gap-1 border-b px-2 pb-2",
        className,
      )}
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
      {...props}
    >
      {children}
    </header>
  );
}

export function SessionBackButton({
  label,
  ...props
}: ComponentProps<typeof Button> & { label: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      className="shrink-0 rounded-full"
      {...props}
    >
      <ArrowLeftIcon className="size-5" />
    </Button>
  );
}

/** Plain title for the phases without a partner (matching, ended). */
export function SessionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="min-w-0 flex-1 truncate px-1 text-sm font-semibold">
      {children}
    </p>
  );
}
