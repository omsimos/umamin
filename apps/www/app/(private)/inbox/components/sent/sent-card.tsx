import type { SelectMessage } from "@umamin/db/schema/message";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@umamin/ui/components/card";
import { formatDistanceToNow } from "date-fns";
import { CircleUserIcon } from "lucide-react";
import { ChatList } from "@/components/chat-list";
import { HoverPrefetchLink } from "@/components/hover-prefetch-link";
import type { PublicUser } from "@/types/user";

export function SentMessageCard({
  data,
}: {
  data: SelectMessage & { receiver: PublicUser };
}) {
  // const menuItems = [
  //   {
  //     title: "View",
  //     onClick: () => {
  //       toast.error("Not implemented yet");
  //     },
  //   },
  //   {
  //     title: "Download",
  //     onClick: () => {
  //       toast.error("Not implemented yet");
  //     },
  //   },
  //   {
  //     title: "Delete",
  //     onClick: () => {
  //       toast.error("Not implemented yet");
  //     },
  //     className: "text-red-500",
  //   },
  // ];
  //

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center text-muted-foreground">
          <div className="flex items-center space-x-2">
            <CircleUserIcon className="h-4 w-4" />
            <HoverPrefetchLink
              href={`/user/${data.receiver?.username}`}
              className="text-sm text-muted-foreground hover:underline"
            >
              {data.receiver?.username}
            </HoverPrefetchLink>
          </div>

          <span className="font-semibold">umamin</span>
          {/* <Menu menuItems={menuItems} /> */}
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
      <CardFooter className="flex justify-center">
        <div className="text-muted-foreground text-sm mt-1 flex gap-1">
          <p className="italic">
            {formatDistanceToNow(data.createdAt, {
              addSuffix: true,
            })}
          </p>

          {/* <ProfileHoverCard user={_recipient}>
                <p className="cursor-pointer hover:underline italic">
                  @johndoe
                </p> 
              </ProfileHoverCard>
          */}
        </div>
      </CardFooter>
    </Card>
  );
}
