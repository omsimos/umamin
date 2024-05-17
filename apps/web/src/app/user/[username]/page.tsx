import { graphql } from "gql.tada";
import { redirect } from "next/navigation";

import { getClient } from "@/lib/gql";
import { UserCard } from "@/app/components/user-card";
import Link from "next/link";
import { cn } from "@ui/lib/utils";
import { Button, buttonVariants } from "@ui/components/ui/button";
import { MessageSquareMore, UserPlus } from "lucide-react";
import { NoteItem } from "@/app/notes/components/note-item";

const USER_BY_USERNAME_QUERY = graphql(`
  query UserByUsername($username: String!) {
    userByUsername(username: $username) {
      __typename
      id
      bio
      note
      username
      imageUrl
      createdAt
    }
  }
`);

export async function generateMetadata({
  params,
}: {
  params: { username: string };
}) {
  const username = params.username.startsWith("%40")
    ? params.username.split("%40").at(1)
    : params.username;
  const title = params.username
    ? `(@${username}) on Umamin`
    : // TODO: Check if user exists
      "User not found | Umamin";

  return {
    title: title,
  };
}

export default async function Page({
  params,
}: {
  params: { username: string };
}) {
  const result = await getClient().query(USER_BY_USERNAME_QUERY, {
    username: params.username,
  });

  const user = result.data?.userByUsername;

  if (!user) {
    redirect("/404");
  }

  return (
    <section className="container max-w-xl lg:mt-36 mt-28">
      <UserCard
        username={user.username}
        bio={user.bio}
        imageUrl={user.imageUrl}
        createdAt={user.createdAt}
      />

      <div className="flex gap-2 mt-3">
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

      {user.note && (
        <div className="mt-8 pt-4 border-t-2 border-dashed border-muted">
          <NoteItem
            username={user.username}
            note={user.note}
            imageUrl={user.imageUrl}
          />
        </div>
      )}
    </section>
  );
}
