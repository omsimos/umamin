import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import { isModerator } from "@/lib/server/moderation";
import { IpDenylistManager } from "./ip-denylist-manager";

export const metadata: Metadata = {
  title: "Moderation — Umamin",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ModerationPage() {
  return (
    <div className="container max-w-lg space-y-6 py-8">
      <Suspense fallback={null}>
        <ModerationContent />
      </Suspense>
    </div>
  );
}

// Session-dependent gate lives inside Suspense so the cookie read doesn't block
// the static page shell (cacheComponents requires this).
async function ModerationContent() {
  const { user } = await getSession();

  // 404 (not redirect) so the route is indistinguishable from a missing page
  // for non-moderators.
  if (!isModerator(user)) {
    notFound();
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Moderation</h1>
        <p className="text-sm text-muted-foreground">
          IP denylist — an Umamin-level block for a specific abusive IP. To ban
          an account, use the Ban action on the member&apos;s profile.
        </p>
      </div>

      <IpDenylistManager />
    </>
  );
}
