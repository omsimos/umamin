import { createFileRoute } from "@tanstack/react-router";
import { BackHeader } from "@/components/back-header";
import { loadFeatureFlags } from "@/lib/loader-flags";
import { pageSeo } from "@/lib/seo";
import { TiersView } from "./-tiers/tiers-view";

const PRO_SEO = {
  title: "Umamin — Plus & Pro",
  description:
    "What you unlock on Free, Plus, and Pro. Plus is free at one year; Pro is a one-time purchase — no subscription.",
};
const PLUS_ONLY_SEO = {
  title: "Umamin — Plus",
  description:
    "What you unlock on Free and Plus. Plus is free once your account is a year old.",
};

type TiersSearch = {
  pro?: "success";
};

export const Route = createFileRoute("/_public/tiers")({
  // Optional-only search — never materialize a default here (the router
  // canonicalizes the URL to whatever this returns; see the /feed 307 gotcha).
  // ?pro=success is the Lemon Squeezy checkout return marker.
  validateSearch: (search: Record<string, unknown>): TiersSearch => ({
    pro: search.pro === "success" ? "success" : undefined,
  }),
  // Primed here so SSR already knows whether Pro is launched — resolving it in
  // the component would paint the Pro tab and then remove it.
  loader: async ({ context }) => {
    const { pro } = await loadFeatureFlags(context.queryClient);
    return { proLaunched: pro };
  },
  head: ({ loaderData }) =>
    pageSeo({
      ...(loaderData?.proLaunched ? PRO_SEO : PLUS_ONLY_SEO),
      robots: "noindex, nofollow",
    }),
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
