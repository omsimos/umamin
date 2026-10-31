import { createFileRoute, notFound } from "@tanstack/react-router";
import { ClientOnlyAdContainer } from "@/components/ad-container-client";
import { BackHeader } from "@/components/back-header";
import { RouteSegmentError } from "@/components/route-segment-error";
import { UserCardSkeleton } from "@/components/skeleton/user-card-skeleton";
import { loadViewer } from "@/lib/loader-viewer";
import { queryKeys } from "@/lib/query";
import { absoluteUrl, pageSeo, truncate, websiteId } from "@/lib/seo";
import type { PublicUserWithBadge } from "@/lib/types";
import { cleanDisplayName, formatUsername } from "@/lib/utils";
import { UserProfile } from "./-components/user-profile";
import { loaderFetchUserProfile } from "./-lib/loader-queries";

export const Route = createFileRoute("/_social/user/$username")({
  loader: async ({ context, params }) => {
    const username = formatUsername(params.username);

    // Resolve the viewer here too, like every other social route: without it
    // the shell SSRs signed-out and the nav swaps once /api/me lands on the
    // client. The profile read is viewer-independent, so these share one round
    // trip's latency instead of chaining.
    const [user] = await Promise.all([
      username ? loaderFetchUserProfile(username) : null,
      loadViewer(context.queryClient),
    ]);

    if (!user) {
      throw notFound();
    }

    context.queryClient.setQueryData(queryKeys.userProfile(username), user);

    return { username, user: user as PublicUserWithBadge };
  },
  head: ({ loaderData }) => {
    const username = loaderData?.username;
    if (!username) {
      return pageSeo({
        title: "User not found | Umamin",
        description: "This user does not exist on Umamin.",
        robots: "noindex",
      });
    }

    const user = loaderData.user;
    const displayName = cleanDisplayName(user.displayName);
    const bio = user.bio?.trim();
    const path = `/user/${username}`;
    const title = displayName
      ? `${displayName} (@${username}) on Umamin`
      : `@${username} on Umamin`;
    const description = bio
      ? truncate(bio, 160)
      : `Profile of @${username} on Umamin. Join Umamin to connect with @${username} and engage in anonymous messaging.`;
    // A profile with no bio and no followers is the same boilerplate page for
    // every handle. Keep those out of the index until there is something on
    // them, so they don't read as thin duplicates of each other.
    const indexable =
      !!bio ||
      user.followerCount > 0 ||
      !!import.meta.env.VITE_VERIFIED_USERS?.split(",").includes(username);

    return pageSeo({
      title,
      description,
      path,
      ogType: "profile",
      twitterCard: "summary",
      robots: indexable ? undefined : "noindex, follow",
      jsonLd: {
        "@type": "ProfilePage",
        url: absoluteUrl(path),
        dateCreated: new Date(user.createdAt).toISOString(),
        isPartOf: { "@id": websiteId() },
        mainEntity: {
          "@type": "Person",
          name: displayName || username,
          alternateName: `@${username}`,
          url: absoluteUrl(path),
          ...(user.imageUrl ? { image: user.imageUrl } : {}),
          ...(bio ? { description: bio } : {}),
          interactionStatistic: {
            "@type": "InteractionCounter",
            interactionType: "https://schema.org/FollowAction",
            userInteractionCount: user.followerCount,
          },
        },
      },
    });
  },
  pendingComponent: UserPending,
  errorComponent: (props) => (
    <RouteSegmentError {...props} heading="We couldn’t load this profile." />
  ),
  notFoundComponent: () => (
    <UserShell>
      <section className="max-w-xl mx-auto min-h-screen container flex items-center justify-center text-center">
        <div>
          <h1 className="text-2xl font-bold">User not found</h1>
          <p className="mt-2 text-muted-foreground">
            This user does not exist on Umamin.
          </p>
        </div>
      </section>
    </UserShell>
  ),
  component: User,
});

function UserShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BackHeader />
      <div className="-mt-8 pt-[env(safe-area-inset-top)] lg:mt-0 lg:pt-0">
        {children}
      </div>
    </>
  );
}

function User() {
  const { username, user } = Route.useLoaderData();

  return (
    <UserShell>
      <section className="max-w-xl mx-auto min-h-screen container">
        <UserProfile username={username} initialUser={user} />

        {/* v2-user */}
        <ClientOnlyAdContainer className="mt-5" placement="profile_bottom" />
      </section>
    </UserShell>
  );
}

function UserPending() {
  return (
    <UserShell>
      <section className="max-w-xl mx-auto min-h-screen container">
        <UserCardSkeleton />
      </section>
    </UserShell>
  );
}
