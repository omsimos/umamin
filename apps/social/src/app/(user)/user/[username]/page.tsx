import Link from "next/link";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { MessageSquareMore, UserPlus } from "lucide-react";

import { cn } from "@umamin/ui/lib/utils";
import { getUserByUsername } from "../../queries";
import { UserCard } from "@/app/components/user-card";
import { Button, buttonVariants } from "@umamin/ui/components/button";

const AdContainer = dynamic(() => import("@umamin/ui/ad"), { ssr: false });

export async function generateMetadata({
  params,
}: {
  params: { username: string };
}) {
  const username = params.username.startsWith("%40")
    ? params.username.split("%40").at(1)
    : params.username;

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
  params: { username: string };
}) {
  const user = await getUserByUsername(params.username);

  if (!user) {
    redirect("/404");
  }

  return (
    <section className="max-w-xl mx-auto lg:mt-36 mt-28">
      <UserCard {...user} />

      <div className="flex gap-2 mt-6 container">
        <Button variant="outline" className="w-full" disabled>
          <UserPlus className="h-4 w-4 mr-2" />
          Follow
        </Button>

        <Link
          href={`/to/${params.username}`}
          className={cn(buttonVariants({ variant: "outline" }), "w-full")}
        >
          <MessageSquareMore className="h-4 w-4 mr-2" />
          Message
        </Link>
      </div>

      {/* v2-user */}
      <AdContainer className="mt-5" slotId="4417432474" />
    </section>
  );
}
