"use client";

import { cn } from "@umamin/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// A menubar entry that highlights when it's the current route. The `!` is
// needed to beat the parent menubar's `*:text-muted-foreground`.
export function MenubarLink({
  href,
  title,
  ariaLabel,
  children,
}: {
  href: string;
  title?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      title={title}
      aria-label={ariaLabel}
      aria-current={active ? "page" : undefined}
      className={cn(active && "text-foreground!")}
    >
      {children}
    </Link>
  );
}
