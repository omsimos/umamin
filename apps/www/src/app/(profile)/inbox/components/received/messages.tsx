import { ReceivedMessagesList } from "./list";
import { getReceivedMessages } from "../../queries";

export async function ReceivedMessages({ sessionId }: { sessionId?: string }) {
  const messages = await getReceivedMessages(sessionId);

  return (
    <div className="flex flex-col items-center gap-5 pb-20">
      {!messages?.length ? (
        <p className="text-sm text-muted-foreground mt-4">
          No messages to show
        </p>
      ) : (
        <ReceivedMessagesList
          messages={messages}
          initialCursor={{
            id: messages[messages.length - 1]?.id ?? null,
            createdAt: messages[messages.length - 1]?.createdAt ?? null,
          }}
        />
      )}
    </div>
  );
}
