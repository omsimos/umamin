import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@umamin/ui/components/card";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { CircleUserIcon } from "lucide-react";
import { ChatListSkeleton } from "@/components/skeleton/chat-list-skeleton";

export function SentMessageCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center text-muted-foreground">
          <div className="flex items-center space-x-2">
            <CircleUserIcon className="h-4 w-4" />
            <Skeleton className="h-4 w-20" />
          </div>
          <span className="font-semibold">umamin</span>
        </div>
      </CardHeader>
      <CardContent className="px-5 sm:px-7">
        <ChatListSkeleton />
      </CardContent>
      <CardFooter className="flex justify-center">
        <div className="text-muted-foreground text-sm mt-1 flex gap-1">
          <Skeleton className="h-4 w-16" />
        </div>
      </CardFooter>
    </Card>
  );
}
