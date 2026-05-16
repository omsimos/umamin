import type { Metadata } from "next";
import { ClientOnlyAdContainer } from "@/components/ad-container-client";
import type { UserProfileResponse } from "@/lib/query-types";
import { fetchMetadataJson } from "@/lib/server-metadata";
import { formatUsername } from "@/lib/utils";
import { UserProfile } from "./user-profile";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const param = await params;
  const username = formatUsername(param.username);

  const user = await fetchMetadataJson<UserProfileResponse>(
    `/api/public/user/${encodeURIComponent(username)}`,
  );

  const title = user
    ? `(@${user.username}) on Umamin`
    : "Umamin — User not found";

  const description = user
    ? `Profile of @${user.username} on Umamin. Join Umamin to connect with @${user.username} and engage in anonymous messaging.`
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

  return (
    <section className="max-w-xl mx-auto min-h-screen container">
      <UserProfile username={formattedUsername} />

      {/* v2-user */}
      <ClientOnlyAdContainer className="mt-5" placement="profile_bottom" />
    </section>
  );
}
