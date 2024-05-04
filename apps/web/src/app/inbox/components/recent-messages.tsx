"use client";

import { nanoid } from "nanoid";
import { graphql } from "gql.tada";
import { useQuery } from "@urql/next";
import { Suspense, useMemo } from "react";
import { Skeleton } from "@umamin/ui/components/skeleton";
import {
  ReceivedMessageCard,
  recentMessageFragment,
} from "./recent-message-card";

export function RecentMessages({ userId }: { userId: string }) {
  const ids = useMemo(() => Array.from({ length: 3 }).map(() => nanoid()), []);

  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={ids[i]} className="w-full h-[200px] rounded-lg" />
          ))}
        </div>
      }
    >
      <Recent userId={userId} />
    </Suspense>
  );
}

const RecentMessagesQuery = graphql(
  `
    query RecentMessages($userId: String!, $type: String!, $cursorId: String) {
      messages(userId: $userId, type: $type, cursorId: $cursorId) {
        id
        ...MessageFragment
      }
    }
  `,
  [recentMessageFragment],
);

function Recent({ userId }: { userId: string }) {
  const [result] = useQuery({
    query: RecentMessagesQuery,
    variables: { userId, type: "recent" },
  });

  const messages = result.data?.messages;

  return (
    <div className="flex flex-col items-center gap-5 pb-20">
      {!messages?.length && (
        <p className="text-sm text-muted-foreground mt-4">
          No messages to show
        </p>
      )}
      {messages?.map((msg) => <ReceivedMessageCard key={msg.id} data={msg} />)}
    </div>
  );
}
