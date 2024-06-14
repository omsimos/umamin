import { Suspense, cache } from "react";
import { cookies } from "next/headers";
import { Skeleton } from "@umamin/ui/components/skeleton";

import { lucia } from "@/lib/auth";
import { getClient } from "@/lib/gql/rsc";
import { SentMessagesList } from "./list";
import { SENT_MESSAGES_QUERY } from "../../queries";

const getMessages = cache(async () => {
  const sessionId = cookies().get(lucia.sessionCookieName)?.value ?? "";

  const res = await getClient(sessionId).query(SENT_MESSAGES_QUERY, {
    type: "sent",
  });

  return res;
});

export async function SentMessages() {
  const result = await getMessages();
  const messages = result.data?.messages;

  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <Skeleton className="w-full h-[300px] rounded-lg" />
          <Skeleton className="w-full h-[300px] rounded-lg" />
          <Skeleton className="w-full h-[300px] rounded-lg" />
        </div>
      }
    >
      <div className="flex w-full flex-col items-center gap-5 pb-20">
        {!messages?.length ? (
          <p className="text-sm text-muted-foreground mt-4">
            No messages to show
          </p>
        ) : (
          <SentMessagesList messages={messages} />
        )}
      </div>
    </Suspense>
  );
}
