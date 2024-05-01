import { graphql } from "gql.tada";
import { getClient } from "@/lib/gql";
import {
  ReceivedMessageCard,
  recentMessageFragment,
} from "./recent-message-card";

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

export async function RecentMessages({ userId }: { userId: string }) {
  const result = await getClient().query(RecentMessagesQuery, {
    userId,
    type: "recent",
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
