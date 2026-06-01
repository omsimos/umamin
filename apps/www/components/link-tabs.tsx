import { cn } from "@umamin/ui/lib/utils";
import Link from "next/link";

type LinkTab = {
  label: string;
  href: string;
  active: boolean;
};

// Full-width underline tab bar shared by the You nav (Posts/Messages) and the
// feed sort switch (Hot/Latest) so the two surfaces stay visually identical.
export function LinkTabs({
  tabs,
  className,
}: {
  tabs: LinkTab[];
  className?: string;
}) {
  return (
    <nav className={cn("flex w-full border-b", className)}>
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "flex-1 border-b-2 px-2 pb-2.5 text-center text-sm font-semibold transition-colors",
            t.active
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
