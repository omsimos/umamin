import { Suspense, cache } from "react";
import { Skeleton } from "@umamin/ui/components/skeleton";

import { getClient } from "@/lib/gql";
import { ReceivedMessagesList } from "./list";
import { RECEIVED_MESSAGES_QUERY } from "../../queries";

const getMessages = cache(async (userId: string) => {
  const res = await getClient().query(RECEIVED_MESSAGES_QUERY, {
    userId,
    type: "received",
  });

  return res;
});

export async function ReceivedMessages({ userId }: { userId: string }) {
  const result = await getMessages(userId);
  const messages = result.data?.messages;

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
