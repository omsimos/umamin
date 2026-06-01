"use client";

import { Button } from "@umamin/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@umamin/ui/components/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@umamin/ui/components/drawer";
import { cn } from "@umamin/ui/lib/utils";
import { ExternalLinkIcon, TriangleAlertIcon } from "lucide-react";
import { type MouseEvent, type ReactNode, useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { analyzeExternalUrl, RISK_LABELS } from "@/lib/external-link";

type Props = {
  href: string;
  className?: string;
  children: ReactNode;
};

// A link in post/comment content that confirms before leaving the app, with a
// heightened warning for risky URLs. Stays a real <a> (focusable, hover preview,
// nofollow) but intercepts the click to route through the dialog.
export function ExternalLink({ href, className, children }: Props) {
  const [open, setOpen] = useState(false);

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // stopPropagation so this doesn't also trigger the post card's full-card
    // open overlay; preventDefault so we show the warning instead of navigating.
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  return (
    <>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        onClick={handleClick}
        className={className}
      >
        {children}
      </a>
      <LinkWarningDialog href={href} open={open} onOpenChange={setOpen} />
    </>
  );
}

function LinkWarningDialog({
  href,
  open,
  onOpenChange,
}: {
  href: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const info = analyzeExternalUrl(href);
  const risky = !info || info.risks.length > 0;

  const proceed = () => {
    onOpenChange(false);
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const title = risky ? "This link may be unsafe" : "Open this link?";
  const description = risky
    ? "Only continue if you trust where it leads."
    : "This opens an external site in a new tab.";

  const body = (
    <div className="space-y-3">
      <div
        className={cn(
          "rounded-lg border p-3",
          risky
            ? "border-red-500/40 bg-red-500/5"
            : "border-border bg-muted/40",
        )}
      >
        <p className="font-medium text-sm break-all">
          {info?.hostname ?? href}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground break-all">{href}</p>
      </div>

      {info && info.risks.length > 0 && (
        <ul className="space-y-1.5">
          {info.risks.map((risk) => (
            <li
              key={risk}
              className="flex items-start gap-2 text-sm text-red-500"
            >
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
              <span>{RISK_LABELS[risk]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const actions = (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => onOpenChange(false)}
      >
        Cancel
      </Button>
      <Button
        type="button"
        variant={risky ? "destructive" : "default"}
        onClick={proceed}
      >
        <ExternalLinkIcon />
        {risky ? "Open anyway" : "Open link"}
      </Button>
    </>
  );

  const heading = (
    <span className={cn("flex items-center gap-2", risky && "text-red-500")}>
      {risky && <TriangleAlertIcon className="size-5 shrink-0" />}
      {title}
    </span>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{heading}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {body}
          <DialogFooter className="mt-4">{actions}</DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="p-4">
        <DrawerHeader className="px-0">
          <DrawerTitle>{heading}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        {body}
        <DrawerFooter className="px-0">{actions}</DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
