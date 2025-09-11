import Link from "next/link";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { MessageSquareMoreIcon, UserPlusIcon } from "lucide-react";

import { SelectUser } from "@umamin/db/schema/user";
import { formatUsername } from "@/lib/utils";
import { Metadata } from "next";
import { Button } from "@umamin/ui/components/button";
import { UserCard } from "@/components/user-card";
import { getUserByUsernameAction } from "@/app/actions/user";

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
  const user = await getUserByUsername(username);

  return (
    <section className="max-w-xl mx-auto min-h-screen container">
      <UserCard user={user} />

      <div className="flex gap-2 mt-6 w-full">
        <Button variant="outline" disabled className="flex-1">
          <UserPlusIcon />
          Follow
        </Button>

        <Button asChild variant="outline" className="flex-1">
          <Link href={`/to/${username}`}>
            <MessageSquareMoreIcon />
            Message
          </Link>
        </Button>
      </div>

      {/* v2-user */}
      <AdContainer className="mt-5" slotId="4417432474" />
    </section>
  );
}

async function getUserByUsername(username: string): Promise<SelectUser> {
  const user = await getUserByUsernameAction(username);
  if (!user) notFound();
  return user as SelectUser;
}
