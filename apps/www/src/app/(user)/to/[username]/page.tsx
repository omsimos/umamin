import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { BadgeCheck, Lock, MessageCircleOff } from "lucide-react";

import { getSession } from "@/lib/auth";
import { getUserByUsername } from "../../queries";
import { ShareButton } from "@/app/components/share-button";
import { Card, CardHeader } from "@umamin/ui/components/card";

const ChatForm = dynamic(() => import("./components/form"));
const UnauthenticatedDialog = dynamic(
  () => import("./components/unauthenticated"),
  { ssr: false }
);

export async function generateMetadata({
  params,
}: {
  params: { username: string };
}) {
  const username = params.username.startsWith("%40")
    ? params.username.split("%40").at(1)
    : params.username;

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
  params: { username: string };
}) {
  const user = await getUserByUsername(params.username);

  if (!user) {
    redirect("/404");
  }

  const { session } = await getSession();

  return (
    <main className="pb-24 min-h-screen flex flex-col justify-center">
      <div className="container w-full max-w-2xl">
        <Card className="border flex flex-col w-full">
          <CardHeader className="bg-background border-b w-full item-center rounded-t-2xl flex justify-between flex-row">
            <div className="flex items-center space-x-1">
              <span className="text-muted-foreground">To:</span>
              <p className="font-semibold text-sm">
                {user?.displayName ? user?.displayName : user?.username}
              </p>
              {process.env.NEXT_PUBLIC_VERIFIED_USERS?.split(",").includes(
                user.username
              ) && <BadgeCheck className="w-4 h-4 text-pink-500" />}
              {user.quietMode && (
                <MessageCircleOff className="h-4 w-4 text-yellow-500" />
              )}

              <ShareButton username={user.username} />
            </div>

            <span className="font-medium text-muted-foreground pb-2">
              umamin
            </span>
          </CardHeader>

          <ChatForm currentUserId={session?.userId} user={user} />
        </Card>
      </div>

      <div className="mt-4 text-muted-foreground text-sm flex items-center justify-center">
        <Lock className="h-4 w-4 mr-2" />
        Advanced Encryption Standard
        <Lock className="h-4 w-4 ml-2" />
      </div>

      <UnauthenticatedDialog isLoggedIn={!!session} />
    </main>
  );
}
