import Link, { type LinkProps } from "next/link";
import { useState } from "react";

type Props = {
  children: React.ReactNode;
  className?: string;
} & LinkProps;

export function HoverPrefetchLink({ children, className, ...rest }: Props) {
  const [active, setActive] = useState(false);

  return (
    <Link
      {...rest}
      className={className}
      prefetch={active ? null : false}
      onMouseEnter={() => setActive(true)}
    >
      {children}
    </Link>
  );
}
