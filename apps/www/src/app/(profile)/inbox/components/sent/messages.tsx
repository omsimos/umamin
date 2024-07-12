import { SentMessagesList } from "./list";
import { getSentMessages } from "../../queries";

export async function SentMessages({ sessionId }: { sessionId: string }) {
  const messages = await getSentMessages(sessionId);

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
