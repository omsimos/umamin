import { Suspense } from "react";
import { cookies } from "next/headers";
import { Skeleton } from "@umamin/ui/components/skeleton";

import { lucia } from "@/lib/auth";
import { getClient } from "@/lib/gql/rsc";
import { ReceivedMessagesList } from "./list";
import { RECEIVED_MESSAGES_QUERY } from "../../queries";

export async function ReceivedMessages() {
  const sessionId = cookies().get(lucia.sessionCookieName)?.value ?? "";
  const result = await getClient(sessionId).query(RECEIVED_MESSAGES_QUERY, {
    type: "received",
  });

  const messages = result?.data?.messages;

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
