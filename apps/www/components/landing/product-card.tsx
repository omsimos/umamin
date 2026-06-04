import { cn } from "@umamin/ui/lib/utils";
import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

const ctaClass =
  "inline-flex items-center gap-1.5 text-sm font-medium text-primary";

export function ProductCard({
  name,
  tag,
  icon,
  accent,
  cta,
  children,
  className,
}: {
  name: string;
  tag: string;
  icon: React.ReactNode;
  accent: string;
  cta: { label: string; href: string; external?: boolean };
  children: React.ReactNode;
  className?: string;
}) {
  const ctaBody = (
    <>
      {cta.label}
      <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
    </>
  );

  return (
    <article
      className={cn(
        "group flex flex-col rounded-2xl border bg-card/50 p-5 transition-colors hover:border-foreground/20",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 pb-4">
        <div className="flex items-center gap-2.5">
          <span
            className={cn("grid size-9 place-items-center rounded-xl", accent)}
          >
            {icon}
          </span>
          <h3 className="font-display text-lg font-bold">{name}</h3>
        </div>
        <span className="whitespace-nowrap rounded-full border border-dashed px-2.5 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          {tag}
        </span>
      </div>

      <div className="flex-1">{children}</div>

      <div className="pt-4">
        {cta.external ? (
          <a
            href={cta.href}
            target="_blank"
            rel="noopener noreferrer"
            className={ctaClass}
          >
            {ctaBody}
          </a>
        ) : (
          <Link href={cta.href} className={ctaClass}>
            {ctaBody}
          </Link>
        )}
      </div>
    </article>
  );
}
