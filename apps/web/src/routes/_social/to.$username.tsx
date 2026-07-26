import { createFileRoute, notFound } from "@tanstack/react-router";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { BadgeCheckIcon, LockIcon } from "lucide-react";
import { ClientOnlyAdContainer } from "@/components/ad-container-client";
import { RouteSegmentError } from "@/components/route-segment-error";
import { ShareButton } from "@/components/share-button";
import { pageSeo } from "@/lib/seo";
import type { PublicUser } from "@/lib/types";
import { formatUsername } from "@/lib/utils";
import { ChatForm } from "./-components/chat-form";
import { ChatFormSkeleton } from "./-components/chat-form-skeleton";
import { loaderFetchUserProfile } from "./-lib/loader-queries";

export const Route = createFileRoute("/_social/to/$username")({
  loader: async ({ params }) => {
    const username = formatUsername(params.username);
    const user = username ? await loaderFetchUserProfile(username) : null;

    if (!user) {
      throw notFound();
    }

    return { username, user: user as PublicUser };
  },
  head: ({ loaderData }) => {
    const username = loaderData?.username ?? "user";
    const title = `Send Encrypted Anonymous Message to @${username} | Umamin`;
    const description = `Send an encrypted anonymous message to @${username} on Umamin. Protect your identity while communicating securely and privately.`;

    return pageSeo({ title, description, path: `/to/${username}` });
  },
  pendingComponent: SendMessagePending,
  errorComponent: (props) => (
    <RouteSegmentError {...props} heading="We couldn’t load this page." />
  ),
  notFoundComponent: () => (
    <div className="w-full max-w-xl container min-h-screen flex items-center justify-center text-center">
      <div>
        <h1 className="text-2xl font-bold">User not found</h1>
        <p className="mt-2 text-muted-foreground">
          This user does not exist on Umamin.
        </p>
      </div>
    </div>
  ),
  component: SendMessage,
});

function SendMessage() {
  const { user } = Route.useLoaderData();

  return (
    <div className="w-full max-w-xl container min-h-screen">
      <section className="border flex flex-col w-full pt-0 rounded-xl bg-card">
        <div className="bg-background border-b w-full item-center px-6 py-4 rounded-t-2xl flex justify-between flex-row">
          <div className="flex items-center space-x-1">
            <span className="text-muted-foreground">To:</span>
            <p className="font-semibold text-sm">
              {user?.displayName ? user?.displayName : user?.username}
            </p>
            {import.meta.env.VITE_VERIFIED_USERS?.split(",").includes(
              user.username,
            ) && <BadgeCheckIcon className="w-4 h-4 text-pink-500" />}

            <ShareButton
              username={user.username}
              className="text-muted-foreground"
            />
          </div>

          <span className="font-medium text-muted-foreground">umamin</span>
        </div>

        <ChatForm user={user} />
      </section>

      <ClientOnlyAdContainer className="mt-4" placement="to_user" />

      <div className="mt-4 text-muted-foreground text-sm flex items-center justify-center">
        <LockIcon className="h-4 w-4 mr-2" />
        Advanced Encryption Standard
        <LockIcon className="h-4 w-4 ml-2" />
      </div>
    </div>
  );
}

function SendMessagePending() {
  return (
    <div className="w-full max-w-xl container">
      <section className="border flex flex-col w-full pt-0 rounded-xl bg-card">
        <div className="bg-background border-b w-full item-center px-6 py-4 rounded-t-2xl flex justify-between flex-row">
          <div className="flex items-center space-x-1">
            <span className="text-muted-foreground">To:</span>
            <Skeleton className="h-4 w-24" />
          </div>

          <span className="font-medium text-muted-foreground">umamin</span>
        </div>

        <ChatFormSkeleton />
      </section>

      <div className="mt-4 text-muted-foreground text-sm flex items-center justify-center">
        <LockIcon className="h-4 w-4 mr-2" />
        Advanced Encryption Standard
        <LockIcon className="h-4 w-4 ml-2" />
      </div>
    </div>
  );
}
