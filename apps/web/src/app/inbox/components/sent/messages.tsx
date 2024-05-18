import { graphql } from "gql.tada";
import { Suspense, cache } from "react";
import { Skeleton } from "@umamin/ui/components/skeleton";

import { getClient } from "@/lib/gql";
import { SentMessagesList } from "./list";
import { sentMessageFragment } from "./card";

const SENT_MESSAGES_QUERY = graphql(
  `
    query Messages($type: String!, $userId: String!) {
      messages(type: $type, userId: $userId) {
        __typename
        id
        createdAt
        ...SentMessageFragment
      }
    }
  `,
  [sentMessageFragment],
);

const getMessages = cache(async (userId: string) => {
  const res = await getClient().query(SENT_MESSAGES_QUERY, {
    userId,
    type: "sent",
  });

  return res;
});

export async function SentMessages({ userId }: { userId: string }) {
  const result = await getMessages(userId);
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
