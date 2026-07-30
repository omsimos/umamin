import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@umamin/ui/components/card";
import { formatDistanceToNow } from "date-fns";
import { CircleUserIcon } from "lucide-react";
import { ChatList } from "@/components/chat-list";
import { Link } from "@/lib/navigation";
import type { MessageWithReceiver } from "@/lib/types";
import { ThreadLink } from "./thread-link";

export function SentMessageCard({ data }: { data: MessageWithReceiver }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center text-muted-foreground">
          <div className="flex items-center space-x-2">
            <CircleUserIcon className="h-4 w-4" />
            <Link
              href={`/user/${data.receiver?.username}`}
              className="text-sm text-muted-foreground hover:underline"
            >
              {data.receiver?.username}
            </Link>
          </div>

          <span className="font-semibold">umamin</span>
        </div>
      </CardHeader>
      <CardContent className="px-5 sm:px-7">
        <ChatList
          imageUrl={data.receiver?.imageUrl}
          question={data.question}
          reply={data.content}
          response={data.reply ?? ""}
        />
      </CardContent>
      <CardFooter className="flex flex-col items-stretch">
        <p className="text-center text-muted-foreground text-sm italic">
          {formatDistanceToNow(data.createdAt, {
            addSuffix: true,
          })}
        </p>
        {(data.reply || data.lastReplyAt) && (
          <ThreadLink
            messageId={data.id}
            lastReplyAt={data.lastReplyAt}
            readAt={data.senderReadAt}
          />
        )}
      </CardFooter>
    </Card>
  );
}
