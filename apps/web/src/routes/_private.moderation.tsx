import { createFileRoute, notFound } from "@tanstack/react-router";
import { pageSeo } from "@/lib/seo";
import { DmReportQueue } from "./-moderation/dm-report-queue";
import { IpDenylistManager } from "./-moderation/ip-denylist-manager";
import { ReviewQueue } from "./-moderation/review-queue";

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
      title: "Moderation | Umamin",
      description: "Moderation tools.",
      robots: "noindex, nofollow",
    }),
  component: ModerationPage,
});

function ModerationPage() {
  return (
    <div className="container max-w-lg space-y-8 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Moderation</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Review</h2>
        <ReviewQueue />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Chat reports</h2>
          <p className="text-sm text-muted-foreground">
            Reported chat messages with the ones just before them. The reported
            message is highlighted.
          </p>
        </div>
        <DmReportQueue />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">IP denylist</h2>
          <p className="text-sm text-muted-foreground">
            An Umamin-level block for a specific abusive IP. To ban an account,
            use the Ban action on the member&apos;s profile.
          </p>
        </div>
        <IpDenylistManager />
      </section>
    </div>
  );
}
