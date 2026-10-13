import { useQuery } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import { cn } from "@umamin/ui/lib/utils";
import { EyeOffIcon, MessageSquareOffIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { privateQueryDefaults, queryKeys } from "@/lib/query";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";
import type { ContentLabel } from "@/lib/types";

// Session-scoped, so a revealed item stays open when a list remounts it
// (same reasoning as the sealed-message reveal in -inbox/received-card.tsx).
const revealed = new Set<string>();

type Props = {
  label: ContentLabel | null | undefined;
  // Unique per item, e.g. `post:<id>`.
  revealKey: string;
  // The author always sees their own content as written.
  isOwn: boolean;
  isAuthenticated: boolean;
  // Private messages pass true: the receiver opted into the filter, so drama
  // is covered like severe content instead of following the feed setting.
  coverDrama?: boolean;
  noun?: string;
  className?: string;
  children: ReactNode;
};

/**
 * Wraps the body of a post, comment, note or message the classifier labelled.
 * Severe content is blurred behind a notice for everyone; drama folds into one
 * line for viewers who hide disputes (the default, and always for logged-out
 * viewers). Nothing is removed: one tap shows it.
 */
export function ContentCover(props: Props) {
  // Most content carries no label; it renders as-is without mounting the
  // reveal state or the current-user subscription below.
  if (!props.label) return props.children;
  return <Covered {...props} label={props.label} />;
}

function Covered({
  label,
  revealKey,
  isOwn,
  isAuthenticated,
  coverDrama,
  noun = "post",
  className,
  children,
}: Props & { label: ContentLabel }) {
  const [isRevealed, setIsRevealed] = useState(() => revealed.has(revealKey));
  const { data: currentUser } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    ...privateQueryDefaults,
    enabled: isAuthenticated && label === "drama" && !coverDrama,
  });

  if (isRevealed) return children;

  if (isOwn) {
    return (
      <>
        {children}
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <EyeOffIcon className="size-3.5 shrink-0" aria-hidden />
          {label === "severe"
            ? `Others see this ${noun} covered.`
            : `Folded for people who hide disputes.`}
        </p>
      </>
    );
  }

  const reveal = () => {
    revealed.add(revealKey);
    setIsRevealed(true);
  };

  const hidesDrama =
    coverDrama || !isAuthenticated || currentUser?.user?.hideDrama !== false;

  if (label === "drama" && !hidesDrama) return children;

  if (label === "drama" && !coverDrama) {
    return (
      <div
        className={cn(
          "relative z-10 mt-1 flex min-h-11 items-center gap-2 text-sm text-muted-foreground",
          className,
        )}
      >
        <MessageSquareOffIcon className="size-4 shrink-0" aria-hidden />
        <p className="flex-1">Hidden: this may be part of a dispute.</p>
        <Button type="button" variant="ghost" size="sm" onClick={reveal}>
          Show
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("relative mt-1", className)}>
      <div
        aria-hidden
        inert
        className="pointer-events-none max-h-48 select-none overflow-hidden blur-md"
      >
        {children}
      </div>
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/60 p-3 text-center">
        <p className="text-sm font-medium">
          This {noun} may contain hurtful content.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={reveal}>
          View
        </Button>
      </div>
    </div>
  );
}
