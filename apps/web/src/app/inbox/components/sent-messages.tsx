import { nanoid } from "nanoid";
import { graphql } from "gql.tada";
import { useQuery } from "@urql/next";
import { Suspense, useMemo } from "react";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { SentMessagesCard, sentMessageFragment } from "./sent-messages-card";

export function SentMessages({ userId }: { userId: string }) {
  const ids = useMemo(() => Array.from({ length: 3 }).map(() => nanoid()), []);

  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={ids[i]} className="w-full h-[300px] rounded-lg" />
          ))}
        </div>
      }
    >
      <Sent userId={userId} />
    </Suspense>
  );
}

const SentMessagesQuery = graphql(
  `
    query Messages($userId: String!, $type: String!, $cursorId: String) {
      messages(userId: $userId, type: $type, cursorId: $cursorId) {
        id
        ...SentMessageFragment
      }
    }
  `,
  [sentMessageFragment],
);

function Sent({ userId }: { userId: string }) {
  const [result] = useQuery({
    query: SentMessagesQuery,
    variables: { userId, type: "sent" },
  });

  const messages = result.data?.messages;

  return (
    <div className="flex w-full flex-col items-center gap-5 pb-20">
      {!messages?.length && (
        <p className="text-sm text-muted-foreground mt-4">
          No messages to show
        </p>
      )}
      {messages?.map((msg) => <SentMessagesCard key={msg.id} data={msg} />)}
    </div>
  );
}
