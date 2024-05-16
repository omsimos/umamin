import { Suspense } from "react";
import { graphql } from "gql.tada";
import { Skeleton } from "@umamin/ui/components/skeleton";

import { getClient } from "@/lib/gql";
import { ReceivedMessagesList } from "./list";
import { ReceivedMessageCard, receivedMessageFragment } from "./card";

const RECEIVED_MESSAGES_QUERY = graphql(
  `
    query RecentMessages($type: String!, $userId: String!) {
      messages(type: $type, userId: $userId) {
        __typename
        id
        createdAt
        ...MessageFragment
      }
    }
  `,
  [receivedMessageFragment],
);

export async function ReceivedMessages({ userId }: { userId: string }) {
  const result = await getClient().query(RECEIVED_MESSAGES_QUERY, {
    userId,
    type: "received",
  });

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
          <>
            {messages?.map((msg) => (
              <ReceivedMessageCard key={msg.id} data={msg} />
            ))}
            <ReceivedMessagesList messages={messages} />
          </>
        )}
      </div>
    </Suspense>
  );
}
