import { createFileRoute } from "@tanstack/react-router";
import { BackHeader } from "@/components/back-header";
import { pageSeo } from "@/lib/seo";
import { TiersView } from "./-tiers/tiers-view";

const title = "Umamin — Plus";
const description =
  "What you unlock on Free, Plus, and Premium. Plus is always free — early access to new features.";

export const Route = createFileRoute("/_public/tiers")({
  head: () => pageSeo({ title, description, robots: "noindex, nofollow" }),
  component: TiersPage,
});

function TiersPage() {
  return (
    <>
      <BackHeader />
      {/* Mobile: trim the parent pt-24 to the compact header height plus the
          standalone safe-area inset; desktop keeps it for the Navbar. Ported
          from apps/www app/(public)/tiers/layout.tsx. */}
      <div className="-mt-8 pt-[env(safe-area-inset-top)] lg:mt-0 lg:pt-0">
        <section className="mx-auto min-h-screen w-full max-w-lg container pb-24">
          <TiersView />
        </section>
      </div>
    </>
  );
}
