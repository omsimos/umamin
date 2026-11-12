import {
  createFileRoute,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { GoogleAuthErrorAlert } from "@/components/google-auth-error-alert";
import { RouteSegmentError } from "@/components/route-segment-error";
import { loadFeatureFlags, loadProOffer } from "@/lib/loader-flags";
import { pageSeo } from "@/lib/seo";
import { SettingsSkeleton } from "./-settings/settings-skeleton";
import { SettingsTabs } from "./-settings/settings-tabs";
import { SignOutButton } from "./-settings/sign-out-button";
import { BackHeaderPage } from "./-shared/chrome";

type SettingsSearch = { error?: string; tab?: "account" | "privacy" };

export const Route = createFileRoute("/_private/settings")({
  // `tab` stays optional with no materialized default (general) — see the
  // /feed sort gotcha: emitting the default canonicalizes every bare URL.
  validateSearch: (search: Record<string, unknown>): SettingsSearch => ({
    error: typeof search.error === "string" ? search.error : undefined,
    tab:
      search.tab === "account" || search.tab === "privacy"
        ? search.tab
        : undefined,
  }),
  // The profile-theme section's non-Pro state is a "Get Pro" upsell, so it needs
  // the flag. The hook it uses defaults to hidden, so this only removes the
  // pop-in once Pro launches — the request happens either way, just later.
  loader: async ({ context }) => {
    await Promise.all([
      loadFeatureFlags(context.queryClient),
      loadProOffer(context.queryClient),
    ]);
  },
  head: () =>
    pageSeo({
      title: "Settings | Umamin",
      description:
        "Manage your preferences and account settings on Umamin. Customize your profile, adjust privacy settings, and control how you interact anonymously.",
      robots: "noindex, nofollow",
    }),
  pendingComponent: SettingsPending,
  errorComponent: SettingsError,
  component: SettingsPage,
});

function SettingsError({ error, reset }: ErrorComponentProps) {
  return (
    <RouteSegmentError
      error={error}
      reset={reset}
      heading="We couldn’t load settings."
    />
  );
}

function SettingsPage() {
  const { error } = Route.useSearch();

  return (
    <BackHeaderPage>
      <div className="w-full mx-auto max-w-lg container min-h-screen pb-24">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl tracking-tight font-semibold">Settings</h1>
          <SignOutButton />
        </div>

        <p className="text-sm text-muted-foreground mb-12">
          Manage your account settings
        </p>

        <GoogleAuthErrorAlert code={error} className="mb-4" />

        <SettingsTabs />
      </div>
    </BackHeaderPage>
  );
}

function SettingsPending() {
  return (
    <BackHeaderPage>
      <div className="w-full mx-auto max-w-lg container min-h-screen pb-24">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-4 w-44" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>

        <div className="mt-12">
          <SettingsSkeleton />
        </div>
      </div>
    </BackHeaderPage>
  );
}
