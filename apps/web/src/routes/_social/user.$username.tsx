import type { QueryClient } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { ClientOnlyAdContainer } from "@/components/ad-container-client";
import { BackHeader } from "@/components/back-header";
import { RouteSegmentError } from "@/components/route-segment-error";
import { UserCardSkeleton } from "@/components/skeleton/user-card-skeleton";
import { ssrSessionCookiePresent } from "@/lib/loader-fetch";
import { loadViewer } from "@/lib/loader-viewer";
import { PUBLIC_PROFILE_MAX_AGE_SECONDS } from "@/lib/profile-cache";
import { PRIVATE_STALE_TIME, PUBLIC_STALE_TIME, queryKeys } from "@/lib/query";
import { absoluteUrl, pageSeo, websiteId } from "@/lib/seo";
import type {
  CurrentUserResponse,
  FeedResponse,
  PublicUserWithBadge,
} from "@/lib/types";
import { formatUsername, visibleText } from "@/lib/utils";
import { UserProfile } from "./-components/user-profile";
import {
  loaderFetchUserPostsPage,
  loaderFetchUserProfile,
  loaderFetchUserProfileViewer,
} from "./-lib/loader-queries";

export const Route = createFileRoute("/_social/user/$username")({
  loader: async ({ context, params, preload }) => {
    const { queryClient } = context;
    const username = formatUsername(params.username);

    // Resolve the viewer here too, like every other social route: without it
    // the shell SSRs signed-out and the nav swaps once /api/me lands on the
    // client. The profile, the first posts page and the viewer's follow state
    // don't depend on each other, so they share one round trip's latency
    // instead of the posts and the Follow button loading after hydration.
    // A hover preload skips the follow state, a private uncached read.
    const [user] = await Promise.all([
      username ? loaderFetchUserProfile(username) : null,
      loadViewer(queryClient),
      username ? primeUserPosts(queryClient, username) : null,
      username && !preload ? primeProfileViewer(queryClient, username) : null,
    ]);

    if (!user) {
      throw notFound();
    }

    // The Worker caches this read, so `user` can predate a change this device
    // already wrote into the cache (a follow, a new avatar). An entry written
    // inside the cache window is kept. An older or invalidated one is replaced.
    const key = queryKeys.userProfile(username);
    const cached = queryClient.getQueryState<PublicUserWithBadge>(key);
    const cachedUser =
      cached &&
      !cached.isInvalidated &&
      Date.now() - cached.dataUpdatedAt < PUBLIC_PROFILE_MAX_AGE_SECONDS * 1000
        ? cached.data
        : undefined;
    if (cachedUser === undefined) queryClient.setQueryData(key, user);

    return { username, user: (cachedUser ?? user) as PublicUserWithBadge };
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
    const displayName = visibleText(user.displayName);
    const bio = visibleText(user.bio);
    const path = `/user/${username}`;
    const title = displayName
      ? `${displayName} (@${username}) on Umamin`
      : `@${username} on Umamin`;
    // The bio schema caps it at 150 characters, so it fits a description.
    const description = bio
      ? bio
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

// Secondary reads: a failure leaves the query for the component to fetch, and
// the page still renders with the profile.
function primeUserPosts(queryClient: QueryClient, username: string) {
  return queryClient
    .ensureInfiniteQueryData({
      queryKey: queryKeys.userPosts(username),
      queryFn: ({ pageParam }) =>
        loaderFetchUserPostsPage(
          username,
          (pageParam as string | null) ?? null,
        ),
      initialPageParam: null as string | null,
      getNextPageParam: (lastPage: FeedResponse) => lastPage.nextCursor,
      staleTime: PUBLIC_STALE_TIME,
    })
    .catch(() => undefined);
}

async function primeProfileViewer(queryClient: QueryClient, username: string) {
  // SSR can only see whether a session cookie is present. The client sees the
  // cached viewer, and skips its own profile, which never reads the overlay.
  const sessionCookie = await ssrSessionCookiePresent();
  if (sessionCookie === false) return;
  if (sessionCookie === null) {
    const viewer = queryClient.getQueryData<CurrentUserResponse>(
      queryKeys.currentUser(),
    )?.user;
    if (!viewer || viewer.username === username) return;
  }

  await queryClient
    .ensureQueryData({
      queryKey: queryKeys.userProfileViewer(username),
      queryFn: () => loaderFetchUserProfileViewer(username),
      staleTime: PRIVATE_STALE_TIME,
    })
    .catch(() => undefined);
}

function User() {
  // Reads the match without the invariant; see Feed in feed.tsx.
  const data = Route.useMatch({
    shouldThrow: false,
    select: (match) => match.loaderData,
  });
  if (!data) return null;
  const { username, user } = data;

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
