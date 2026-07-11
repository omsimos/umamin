import Link from "next/link";
import { useState } from "react";

type Props = React.ComponentProps<typeof Link>;

// A <Link> that only prefetches once hovered (pointer intent) instead of when
// it scrolls into view. In long virtualized lists (feed/notes) viewport
// prefetch fires a speculative RSC request per row — dozens per page; hover-
// gating collapses that to near-zero on the dominant mobile path (no hover)
// while keeping instant desktop navigation. Any caller-supplied prefetch is
// intentionally overridden.
export function HoverPrefetchLink({ children, onMouseEnter, ...rest }: Props) {
  const [active, setActive] = useState(false);

  return (
    <Link
      {...rest}
      prefetch={active ? null : false}
      onMouseEnter={(e) => {
        setActive(true);
        onMouseEnter?.(e);
      }}
    >
      {children}
    </Link>
  );
}
