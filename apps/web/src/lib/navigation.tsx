import {
  Link as RouterLink,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import type { ComponentType, MouseEvent, ReactNode } from "react";

// Phase 3a navigation shim. The page routes land in Phase 3b, so the route tree
// is still effectively just `/` and TanStack Router's strict `to` typing can't
// validate app paths (`/feed`, `/user/$username`, …) yet. This module gives the
// ported components a loose, framework-agnostic surface that mirrors what they
// used under Next: a `<Link>` (mechanical swap for `next/link`, `href`→`to`),
// `usePathname`, and `useAppNavigate` (replaces `next/navigation`'s
// `useRouter().push/replace`). Phase 3b can tighten these to the typed router
// APIs once the routes exist.

type LooseLinkProps = {
  to?: string;
  href?: string;
  params?: Record<string, unknown>;
  search?: Record<string, unknown> | boolean;
  replace?: boolean;
  // HoverPrefetchLink toggles this; TanStack accepts false | "intent" | "render".
  preload?: false | "intent" | "render" | null;
  prefetch?: unknown;
  className?: string;
  title?: string;
  target?: string;
  rel?: string;
  children?: ReactNode;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  onMouseEnter?: (e: MouseEvent<HTMLAnchorElement>) => void;
  "aria-label"?: string;
  "aria-current"?: "page" | undefined | boolean;
  [key: string]: unknown;
};

const LooseLink = RouterLink as unknown as ComponentType<
  Record<string, unknown>
>;

export function Link({
  to,
  href,
  prefetch: _prefetch,
  ...rest
}: LooseLinkProps) {
  return <LooseLink to={to ?? href ?? "#"} {...rest} />;
}

export function usePathname(): string {
  return useLocation({ select: (l) => l.pathname });
}

type NavigateOptions = { replace?: boolean };

export function useAppNavigate() {
  const navigate = useNavigate();
  return (to: string, opts?: NavigateOptions) =>
    (navigate as unknown as (o: { to: string; replace?: boolean }) => void)({
      to,
      replace: opts?.replace,
    });
}
