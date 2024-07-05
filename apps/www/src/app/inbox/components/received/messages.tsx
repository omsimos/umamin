import { cache, Suspense } from "react";
import { Skeleton } from "@umamin/ui/components/skeleton";

import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/gql/rsc";
import { ReceivedMessagesList } from "./list";
import { RECEIVED_MESSAGES_QUERY } from "../../queries";

const getMessages = cache(async (sessionId?: string) => {
  const result = await getClient(sessionId).query(RECEIVED_MESSAGES_QUERY, {
    type: "received",
  });

  return result?.data?.messages;
});

export async function ReceivedMessages() {
  const { session } = await getSession();
  const messages = await getMessages(session?.id);

  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <Skeleton className="w-full h-[200px] rounded-lg" />
          <Skeleton className="w-full h-[200px] rounded-lg" />
          <Skeleton className="w-full h-[200px] rounded-lg" />
        </div>
      }
    >
      <div className="flex flex-col items-center gap-5 pb-20">
        {!messages?.length ? (
          <p className="text-sm text-muted-foreground mt-4">
            No messages to show
          </p>
        ) : (
          <ReceivedMessagesList messages={messages} />
        )}
      </div>
    </Suspense>
  );
}
