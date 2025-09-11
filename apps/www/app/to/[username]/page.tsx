import { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheckIcon, LockIcon, MessageCircleOffIcon } from "lucide-react";

import { getSession } from "@/lib/auth";
import { formatUsername } from "@/lib/utils";
import { ChatForm } from "./components/chat-form";
import { ShareButton } from "@/components/share-button";
import UnauthenticatedDialog from "@/components/unauthenticated-dialog";
import { getUserByUsernameAction } from "@/app/actions/user";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const param = await params;
  const username = formatUsername(param.username);

  const title = `Send Encrypted Anonymous Message to @${username} | Umamin`;

  const description = `Send an encrypted anonymous message to @${username} on Umamin. Protect your identity while communicating securely and privately.`;

  return {
    title,
    description,
    keywords: [
      `anonymous message`,
      `encrypted messaging`,
      `send message to ${username}`,
      `secure communication`,
      `Umamin`,
    ],
    openGraph: {
      type: "website",
      title,
      description,
      url: `https://www.umamin.link/to/${username}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function SendMessage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const user = await getUserByUsernameAction(username);

  if (!user) {
    notFound();
  }

  const { session } = await getSession();

  return (
    <div className="w-full max-w-xl container min-h-screen">
      <section className="border flex flex-col w-full pt-0 rounded-xl bg-card">
        <div className="bg-background border-b w-full item-center px-6 py-4 rounded-t-2xl flex justify-between flex-row">
          <div className="flex items-center space-x-1">
            <span className="text-muted-foreground">To:</span>
            <p className="font-semibold text-sm">
              {user?.displayName ? user?.displayName : user?.username}
            </p>
            {process.env.NEXT_PUBLIC_VERIFIED_USERS?.split(",").includes(
              user.username,
            ) && <BadgeCheckIcon className="w-4 h-4 text-pink-500" />}
            {user.quietMode && (
              <MessageCircleOffIcon className="h-4 w-4 text-yellow-500" />
            )}

            <ShareButton username={user.username} />
          </div>

          <span className="font-medium text-muted-foreground">umamin</span>
        </div>

        <ChatForm user={user} />
      </section>

      <div className="mt-4 text-muted-foreground text-sm flex items-center justify-center">
        <LockIcon className="h-4 w-4 mr-2" />
        Advanced Encryption Standard
        <LockIcon className="h-4 w-4 ml-2" />
      </div>

      <UnauthenticatedDialog isLoggedIn={!!session} />
    </div>
  );
}
