import { Suspense } from "react";
import { redirect } from "next/navigation";

import { ChatBox } from "@/app/components/chatbox";
import { GetUserByUsernameQuery, getClient } from "@/lib/gql";

export default async function SendMessage({
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
    <main className="mt-36 grid place-items-center container">
      <Suspense fallback={<div>Loading...</div>}>
        {user && <ChatBox {...user} />}
      </Suspense>
    </main>
  );
}
