import { createFileRoute, notFound } from "@tanstack/react-router";
import { pageSeo } from "@/lib/seo";
import { IpDenylistManager } from "./-moderation/ip-denylist-manager";

// Moderator-gated. The parent _private beforeLoad already ensured the
// current-user query and returns it in context; a non-moderator gets notFound
// (404, not a redirect) so the route is indistinguishable from a missing page.
export const Route = createFileRoute("/_private/moderation")({
  beforeLoad: ({ context }) => {
    if (!context.currentUser?.user?.isModerator) {
      throw notFound();
    }
  },
  head: () =>
    pageSeo({
      title: "Moderation — Umamin",
      description: "Moderation tools.",
      robots: "noindex, nofollow",
    }),
  component: ModerationPage,
});

function ModerationPage() {
  return (
    <div className="container max-w-lg space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Moderation</h1>
        <p className="text-sm text-muted-foreground">
          IP denylist — an Umamin-level block for a specific abusive IP. To ban
          an account, use the Ban action on the member&apos;s profile.
        </p>
      </div>

      <IpDenylistManager />
    </div>
  );
}
