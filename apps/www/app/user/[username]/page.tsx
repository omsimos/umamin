import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { getUserProfileAction } from "@/app/actions/user";
import { getSession } from "@/lib/auth";
import { formatUsername } from "@/lib/utils";
import { UserProfile } from "./user-profile";

const AdContainer = dynamic(() => import("@/components/ad-container"));

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
  const { session } = await getSession();
  const user = await getUserProfileAction(username);

  if (!user) {
    notFound();
  }

  return (
    <section className="max-w-xl mx-auto min-h-screen container">
      <UserProfile
        user={user}
        currentUserId={session?.userId}
        isAuthenticated={!!session}
      />

      {/* v2-user */}
      <AdContainer className="mt-5" slotId="4417432474" />
    </section>
  );
}
