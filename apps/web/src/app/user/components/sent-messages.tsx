import { graphql } from "gql.tada";
import { getClient } from "@/lib/gql";
import { SentMessagesCard, sentMessageFragment } from "./sent-messages-card";

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

export async function SentMessages({ userId }: { userId: string }) {
  const result = await getClient().query(SentMessagesQuery, {
    userId,
    type: "sent",
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
