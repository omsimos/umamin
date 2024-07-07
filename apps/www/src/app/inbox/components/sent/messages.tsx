import { cache } from "react";
import { getClient } from "@/lib/gql/rsc";
import { SentMessagesList } from "./list";
import { SENT_MESSAGES_QUERY } from "../../queries";

const getMessages = cache(async (sessionId?: string) => {
  const result = await getClient(sessionId).query(SENT_MESSAGES_QUERY, {
    type: "sent",
  });

  return result?.data?.messages;
});

export async function SentMessages({ sessionId }: { sessionId: string }) {
  const messages = await getMessages(sessionId);

  return (
    <div className="flex w-full flex-col items-center gap-5 pb-20">
      {!messages?.length ? (
        <p className="text-sm text-muted-foreground mt-4">
          No messages to show
        </p>
      ) : (
        <SentMessagesList messages={messages} />
      )}
    </div>
  );
}
