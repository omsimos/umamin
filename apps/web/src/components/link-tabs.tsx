import { cn } from "@umamin/ui/lib/utils";
import { Link } from "@/lib/navigation";

type LinkTab = {
  label: string;
  href: string;
  active: boolean;
  /** An unread count shown next to the label; hidden at 0. */
  badge?: number;
};

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
          {t.badge ? (
            <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 align-[1px] text-[10px] font-medium leading-none text-primary-foreground">
              {t.badge > 20 ? "20+" : t.badge}
              <span className="sr-only"> unread</span>
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
