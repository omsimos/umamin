import Link from "next/link";
import { cache } from "react";
import { graphql } from "gql.tada";
import { redirect } from "next/navigation";
import { MessageSquareMore, UserPlus } from "lucide-react";

import { cn } from "@ui/lib/utils";
import { getClient } from "@/lib/gql";
import { UserCard } from "@/app/components/user-card";
import { NoteCard } from "@/app/notes/components/note-card";
import { Button, buttonVariants } from "@ui/components/ui/button";

const USER_BY_USERNAME_QUERY = graphql(`
  query UserByUsername($username: String!) {
    userByUsername(username: $username) {
      __typename
      id
      bio
      username
      imageUrl
      createdAt
      note {
        __typename
        id
        content
        updatedAt
        isAnonymous
      }
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

const getUser = cache(async (username: string) => {
  const res = await getClient().query(USER_BY_USERNAME_QUERY, {
    username,
  });

  return res;
});

export default async function Page({
  params,
}: {
  params: { username: string };
}) {
  const result = await getUser(params.username);
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

      {user.note && !user.note.isAnonymous && (
        <div className="mt-8 pt-4 border-t-2 border-dashed border-muted">
          <NoteCard
            username={user.username}
            note={user.note.content}
            updatedAt={user.note.updatedAt}
            imageUrl={user.imageUrl}
          />
        </div>
      )}
    </section>
  );
}
