import { cn } from "@umamin/ui/lib/utils";
import type { ProTheme } from "@/lib/pro";
import { activeProTheme, hasUmaminPro } from "@/lib/pro";

// The entire Pro visual language lives in this file (plus the
// .profile-theme-* variable blocks in the shared globals.css) so "subtle,
// never overdone" stays reviewable in one place. Rendering RULES live in
// lib/pro.ts (hasUmaminPro / activeProTheme).

/**
 * The explicit Pro chip. Profile-header-only by design — lists never gain an
 * extra inline glyph. Colored off the primary token, so inside a themed
 * profile it automatically matches the wearer's theme, and elsewhere it's the
 * brand color. Renders nothing unless the horizon is in the future
 * (self-corrects on expiry even from cached payloads).
 */
export function ProBadge({
  proUntil,
  className,
}: {
  proUntil?: Date | string | null;
  className?: string;
}) {
  if (!hasUmaminPro(proUntil)) return null;
  return (
    <span
      className={cn(
        "rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-semibold text-[10px] text-primary leading-none tracking-wide",
        className,
      )}
    >
      PRO
    </span>
  );
}

// Literal class strings only — Tailwind scans source for them, so never build
// these dynamically. The classes are defined in packages/ui globals.css.
export const PRO_THEME_STYLES: Record<
  ProTheme,
  { label: string; className: string }
> = {
  ocean: { label: "Ocean", className: "profile-theme-ocean" },
  forest: { label: "Forest", className: "profile-theme-forest" },
  ember: { label: "Ember", className: "profile-theme-ember" },
  orchid: { label: "Orchid", className: "profile-theme-orchid" },
  gold: { label: "Gold", className: "profile-theme-gold" },
  mono: { label: "Mono", className: "profile-theme-mono" },
};

/**
 * Wrapper class for a profile-owned surface (profile page, /to page), or
 * undefined. Entitlement is re-checked inside activeProTheme, so a lapsed
 * Pro's page renders unthemed no matter what is stored.
 */
export function proThemeClass(
  user?: {
    proUntil?: Date | string | null;
    profileTheme?: string | null;
  } | null,
): string | undefined {
  const theme = activeProTheme(user);
  return theme ? PRO_THEME_STYLES[theme].className : undefined;
}
