import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@umamin/ui/components/card";
import { formatDistanceToNow } from "date-fns";
import { CircleUserIcon, MessagesSquareIcon } from "lucide-react";
import { ChatList } from "@/components/chat-list";
import { Link } from "@/lib/navigation";
import type { MessageWithReceiver } from "@/lib/types";
import { hasUnreadThread } from "./thread-unread";

export function SentMessageCard({ data }: { data: MessageWithReceiver }) {
  const unread = hasUnreadThread(data.lastReplyAt, data.senderReadAt);

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
      <CardFooter className="flex flex-col items-center gap-2">
        <div className="text-muted-foreground text-sm mt-1 flex gap-1">
          <p className="italic">
            {formatDistanceToNow(data.createdAt, {
              addSuffix: true,
            })}
          </p>
        </div>
        <Link
          href={`/inbox/${data.id}`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:underline"
        >
          <MessagesSquareIcon className="h-4 w-4" aria-hidden />
          View conversation
          {unread && (
            <>
              <span aria-hidden className="size-2 rounded-full bg-primary" />
              <span className="sr-only">New reply</span>
            </>
          )}
        </Link>
      </CardFooter>
    </Card>
  );
}
