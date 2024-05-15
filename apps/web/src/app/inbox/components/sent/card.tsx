import { CircleUser } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { FragmentOf, readFragment, graphql } from "gql.tada";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@umamin/ui/components/card";
import { ChatList } from "@/app/components/chat-list";

export const sentMessageFragment = graphql(`
  fragment SentMessageFragment on Message {
    question
    content
    createdAt
    user {
      id
      imageUrl
      username
    }
  }
`);

export function SentMessageCard({
  data,
}: {
  data: FragmentOf<typeof sentMessageFragment>;
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

  const msg = readFragment(sentMessageFragment, data);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center text-muted-foreground">
          <div className="flex items-center space-x-2">
            <CircleUser className="h-4 w-4" />
            <p className="text-sm text-muted-foreground">
              {msg.user?.username}
            </p>
          </div>

          <span className="font-semibold">umamin</span>
          {/* <Menu menuItems={menuItems} /> */}
        </div>
      </CardHeader>
      <CardContent className="px-5 sm:px-7">
        <ChatList
          imageUrl={msg.user?.imageUrl}
          question={msg.question}
          reply={msg.content}
        />
      </CardContent>
      <CardFooter className="flex justify-center">
        <div className="text-muted-foreground text-sm mt-1 flex gap-1">
          <p className="italic">
            {formatDistanceToNow(new Date(msg.createdAt), {
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
