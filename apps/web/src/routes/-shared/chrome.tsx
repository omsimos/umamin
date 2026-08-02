import type { ReactNode } from "react";
import { BackHeader } from "@/components/back-header";

// Ports the per-page (private) layout.tsx wrapper from apps/www (inbox /
// notifications / settings / groups): the mobile focused-view BackHeader plus
// the offset that trims the shared pt-24 to the compact header height (with the
// standalone safe-area inset) on mobile, restoring pt-24 on desktop.
export function BackHeaderPage({
  children,
  backHref,
  backLabel,
}: {
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <>
      <BackHeader backHref={backHref} backLabel={backLabel} />
      <div className="-mt-8 pt-[env(safe-area-inset-top)] lg:mt-0 lg:pt-0">
        {children}
      </div>
    </>
  );
}
