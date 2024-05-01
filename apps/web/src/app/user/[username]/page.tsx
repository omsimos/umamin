import { redirect } from "next/navigation";

import { UserCard } from "../components/user-card";
import { GetUserByUsernameQuery, getClient } from "@/lib/gql";

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
  const result = await getClient().query(GetUserByUsernameQuery, {
    username: params.username,
  });

  const user = result.data?.getUserByUsername;

  if (!user) {
    redirect("/404");
  }

  return (
    <section className="container max-w-xl space-y-3 lg:mt-36 mt-28">
      <UserCard {...user} />
    </section>
  );
}
