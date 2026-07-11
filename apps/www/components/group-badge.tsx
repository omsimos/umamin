"use client";

import { Badge } from "@umamin/ui/components/badge";
import { cn } from "@umamin/ui/lib/utils";
import Link from "next/link";
import type { GroupAccent, GroupIcon } from "@/lib/group";
import { GROUP_ACCENT_CLASSES, GROUP_ICON_MAP } from "@/lib/group-icons";
import type { GroupBadgeData } from "@/types/group";

/**
 * The nameplate group badge — muted chip, accent tint on the icon only (lists
 * full of bright ornaments read as noise on mobile). Tapping through to the
 * group page is the feature's whole discovery loop. An unknown icon/accent
 * (allowlist drift) renders text-only/untinted rather than breaking.
 */
export function GroupBadge({
  badge,
  className,
  // Set false when the badge sits inside another link (no nested anchors) —
  // it renders as a plain chip instead of tapping through to the group page.
  linked = true,
}: {
  badge?: GroupBadgeData | null;
  className?: string;
  linked?: boolean;
}) {
  if (!badge) {
    return null;
  }

  const Icon = GROUP_ICON_MAP[badge.icon as GroupIcon];
  const accent =
    badge.accent && badge.accent in GROUP_ACCENT_CLASSES
      ? GROUP_ACCENT_CLASSES[badge.accent as GroupAccent]
      : undefined;

  const content = (
    <>
      {Icon ? <Icon className={accent} aria-hidden /> : null}
      {badge.tag}
    </>
  );

  if (!linked) {
    return (
      <Badge
        variant="secondary"
        className={cn(
          "gap-1 px-1.5 py-0 text-[10px] font-semibold tracking-wide",
          className,
        )}
      >
        {content}
      </Badge>
    );
  }

  return (
    <Badge
      variant="secondary"
      asChild
      // relative z-10 lifts it above the post cards' whole-card link overlay.
      className={cn(
        "relative z-10 gap-1 px-1.5 py-0 text-[10px] font-semibold tracking-wide",
        className,
      )}
    >
      <Link
        href={`/groups/${badge.tag}`}
        aria-label={`${badge.tag} group`}
        prefetch={false}
      >
        {content}
      </Link>
    </Badge>
  );
}
