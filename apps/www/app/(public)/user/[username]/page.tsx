import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientOnlyAdContainer } from "@/components/ad-container-client";
import { getQueryClient } from "@/lib/get-query-client";
import { queryKeys } from "@/lib/query";
import { getPublicUserProfileData } from "@/lib/server/data";
import { formatUsername } from "@/lib/utils";
import { UserProfile } from "./user-profile";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const param = await params;
  const username = formatUsername(param.username);

  const title = username
    ? `(@${username}) on Umamin`
    : "Umamin — User not found";

  const description = username
    ? `Profile of @${username} on Umamin. Join Umamin to connect with @${username} and engage in anonymous messaging.`
    : "This user does not exist on Umamin.";

  return {
    title,
    description,
    keywords: [
      `Umamin profile`,
      `@${username}`,
      `anonymous messaging`,
      `user activity`,
      `Umamin user`,
    ],
    openGraph: {
      type: "profile",
      title,
      description,
      url: `https://www.umamin.link/user/${username}`,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const formattedUsername = formatUsername(username);
  const user = await getPublicUserProfileData(formattedUsername);

  if (!user) {
    notFound();
  }

  const queryClient = getQueryClient();
  queryClient.setQueryData(queryKeys.userProfile(formattedUsername), user);

  return (
    <section className="max-w-xl mx-auto min-h-screen container">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <UserProfile username={formattedUsername} initialUser={user} />
      </HydrationBoundary>

      {/* v2-user */}
      <ClientOnlyAdContainer className="mt-5" placement="profile_bottom" />
    </section>
  );
}
