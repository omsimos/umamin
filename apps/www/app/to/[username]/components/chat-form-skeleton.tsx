"use client";

import { Button } from "@umamin/ui/components/button";
import { Textarea } from "@umamin/ui/components/textarea";
import { cn } from "@umamin/ui/lib/utils";
import { SendIcon } from "lucide-react";
import { ChatListSkeleton } from "@/components/skeleton/chat-list-skeleton";

export function ChatFormSkeleton() {
  return (
    <div
      className={cn(
        "flex flex-col justify-between pb-6 h-full max-h-[400px] relative w-full min-w-0",
        "min-h-[350px]",
      )}
    >
      <div className="flex flex-col h-full overflow-scroll pt-10 px-5 sm:px-7 pb-5 w-full relative min-w-0 ">
        <ChatListSkeleton />
      </div>

      <form className="px-5 sm:px-7 flex items-center space-x-2 w-full self-center pt-2 max-w-lg">
        <Textarea
          disabled
          placeholder="Type your anonymous message..."
          className="focus-visible:ring-transparent text-base resize-none min-h-10 max-h-20"
        />
        <Button type="button" size="icon" disabled>
          <SendIcon className="h-4 w-4" />
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  );
}
