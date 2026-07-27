import { createFileRoute, notFound } from "@tanstack/react-router";
import { ClientOnlyAdContainer } from "@/components/ad-container-client";
import { BackHeader } from "@/components/back-header";
import { RouteSegmentError } from "@/components/route-segment-error";
import { UserCardSkeleton } from "@/components/skeleton/user-card-skeleton";
import { queryKeys } from "@/lib/query";
import { pageSeo } from "@/lib/seo";
import type { PublicUserWithBadge } from "@/lib/types";
import { formatUsername } from "@/lib/utils";
import { UserProfile } from "./-components/user-profile";
import { loaderFetchUserProfile } from "./-lib/loader-queries";

export const Route = createFileRoute("/_social/user/$username")({
  loader: async ({ context, params }) => {
    const username = formatUsername(params.username);
    const user = username ? await loaderFetchUserProfile(username) : null;

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
        title: "Umamin — User not found",
        description: "This user does not exist on Umamin.",
        robots: "noindex",
      });
    }

    const title = `(@${username}) on Umamin`;
    const description = `Profile of @${username} on Umamin. Join Umamin to connect with @${username} and engage in anonymous messaging.`;

    return pageSeo({
      title,
      description,
      path: `/user/${username}`,
      ogType: "profile",
      twitterCard: "summary",
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
