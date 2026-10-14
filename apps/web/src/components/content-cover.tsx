import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import { cn } from "@umamin/ui/lib/utils";
import { EyeOffIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Uma } from "@/components/uma";
import { type CoverKind, UmaExplainer } from "@/components/uma-explainer";
import { callAction } from "@/lib/api";
import { ExpectedError } from "@/lib/expected-error";
import { privateQueryDefaults, queryKeys } from "@/lib/query";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";
import type { ContentLabel, ReviewKind } from "@/lib/types";
import { getActionError } from "@/lib/utils";

// Session-scoped, so a revealed item stays open when a list remounts it
// (same reasoning as the sealed-message reveal in -inbox/received-card.tsx).
const revealed = new Set<string>();
// Same scope for review requests, so a remounted item doesn't offer again.
const requested = new Set<string>();

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
  // The public item behind the cover. Enables the author's review request and
  // a viewer's "got this wrong"; private messages leave it out.
  target?: { kind: ReviewKind; id: string };
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
  target,
  className,
  children,
}: Props & { label: ContentLabel }) {
  const appeal = useReviewRequest(target, "appealContentLabelAction");
  const dispute = useReviewRequest(target, "disputeContentLabelAction");
  const [isRevealed, setIsRevealed] = useState(() => revealed.has(revealKey));
  const [revealedHere, setRevealedHere] = useState(false);
  // The explainer mounts on first open, so a list of covers doesn't each
  // build a dialog up front.
  const [whyOpen, setWhyOpen] = useState(false);
  const [whyMounted, setWhyMounted] = useState(false);
  const { data: currentUser } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    ...privateQueryDefaults,
    enabled: isAuthenticated && label === "drama" && !coverDrama,
  });

  if (revealedHere) return <FocusOnMount>{children}</FocusOnMount>;
  if (isRevealed) return children;

  if (isOwn) {
    return (
      <>
        {children}
        <div className="relative z-10 mt-2 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <EyeOffIcon className="size-3.5 shrink-0" aria-hidden />
          <p>
            {label === "severe"
              ? `Others see this ${noun} covered.`
              : `Folded for people who hide disputes.`}
          </p>
          {target &&
            (appeal.sent ? (
              <p className="flex h-8 items-center">Sent for review.</p>
            ) : (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-8 px-0 text-xs text-muted-foreground underline"
                disabled={appeal.pending}
                onClick={appeal.send}
              >
                Ask for review
              </Button>
            ))}
        </div>
      </>
    );
  }

  const reveal = () => {
    revealed.add(revealKey);
    setIsRevealed(true);
    setRevealedHere(true);
  };

  const hidesDrama =
    coverDrama || !isAuthenticated || currentUser?.user?.hideDrama !== false;

  if (label === "drama" && !hidesDrama) return children;

  const kind: CoverKind = coverDrama
    ? "message"
    : label === "drama"
      ? "dispute"
      : "severe";

  const whyButton = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-muted-foreground underline underline-offset-4"
      onClick={() => {
        setWhyMounted(true);
        setWhyOpen(true);
      }}
    >
      Why?
    </Button>
  );

  const explainer = whyMounted && (
    <UmaExplainer
      kind={kind}
      noun={noun}
      open={whyOpen}
      onOpenChange={setWhyOpen}
      onReveal={reveal}
      dispute={target && isAuthenticated ? dispute : undefined}
    />
  );

  if (kind === "dispute") {
    return (
      <div
        className={cn(
          "relative z-10 mt-1 flex min-h-11 items-center gap-2 text-sm text-muted-foreground",
          className,
        )}
      >
        <Uma className="size-5" />
        <p className="flex-1 truncate">Folded: possible dispute</p>
        {whyButton}
        <Button type="button" variant="ghost" size="sm" onClick={reveal}>
          Show
        </Button>
        {explainer}
      </div>
    );
  }

  return (
    <div className={cn("relative mt-1 min-h-36", className)}>
      <div
        aria-hidden
        inert
        className="pointer-events-none max-h-48 select-none overflow-hidden blur-md"
      >
        {children}
      </div>
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/60 p-3 text-center">
        <Uma mood="serious" className="size-9" />
        <p className="text-sm font-medium">
          This {noun} may contain hurtful content.
        </p>
        <div className="flex items-center gap-1">
          {whyButton}
          <Button type="button" variant="outline" size="sm" onClick={reveal}>
            View
          </Button>
        </div>
      </div>
      {explainer}
    </div>
  );
}

export type ReviewRequest = {
  sent: boolean;
  pending: boolean;
  send: () => void;
};

function useReviewRequest(
  target: Props["target"],
  name: "appealContentLabelAction" | "disputeContentLabelAction",
): ReviewRequest {
  const key = target && `${name}:${target.kind}:${target.id}`;
  const [sent, setSent] = useState(() => !!key && requested.has(key));
  const mutation = useMutation({
    mutationFn: async () => {
      const error = getActionError(await callAction(name, target));
      if (error) throw new ExpectedError(error);
    },
    onSuccess: () => {
      if (key) requested.add(key);
      setSent(true);
    },
    onError: (error) =>
      toast.error(
        error instanceof ExpectedError
          ? error.message
          : "Couldn't send that. Try again.",
      ),
  });
  return { sent, pending: mutation.isPending, send: () => mutation.mutate() };
}

// Revealing removes the button that had focus. Moves focus to what it
// revealed, after the explainer's own focus return when it was opened.
function FocusOnMount({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = setTimeout(() => ref.current?.focus({ preventScroll: true }));
    return () => clearTimeout(id);
  }, []);
  return (
    <div ref={ref} tabIndex={-1} className="outline-none">
      {children}
    </div>
  );
}
