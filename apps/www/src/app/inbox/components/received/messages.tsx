import { cache } from "react";
import { getClient } from "@/lib/gql/rsc";
import { ReceivedMessagesList } from "./list";
import { RECEIVED_MESSAGES_QUERY } from "../../queries";

const getMessages = cache(async (sessionId?: string) => {
  const result = await getClient(sessionId).query(RECEIVED_MESSAGES_QUERY, {
    type: "received",
  });

  return result?.data?.messages;
});

export async function ReceivedMessages({ sessionId }: { sessionId?: string }) {
  const messages = await getMessages(sessionId);

  return (
    <div className="flex flex-col items-center gap-5 pb-20">
      {!messages?.length ? (
        <p className="text-sm text-muted-foreground mt-4">
          No messages to show
        </p>
      ) : (
        <ReceivedMessagesList messages={messages} />
      )}
    </div>
  );
}
