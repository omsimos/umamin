import { Avatar, AvatarFallback } from "@umamin/ui/components/avatar";
import { cn } from "@umamin/ui/lib/utils";
import { ScanFace } from "lucide-react";

type Message = {
  role: string;
  content: string;
  // Profile info for profile hover card
};

export const ChatList = ({ messages }: { messages: Message[] }) => {
  return (
    <div className='h-full flex pb-10 overflow-y-auto flex-col w-full py-10 px-5 sm:px-7 gap-4'>
      {/* Update key={i} to key={message.id} in the map function */}
      {messages.map((message) => (
        <div key={message.content} className='flex gap-2 items-center'>
          {message.role !== "user" && (
            <Avatar>
              <AvatarFallback>
                <ScanFace />
              </AvatarFallback>
            </Avatar>
          )}
          <div
            className={cn(
              "flex w-max max-w-[75%] sm:max-w-[55%] flex-col gap-2 rounded-lg px-3 py-2 whitespace-pre-wrap",
              message.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "bg-muted"
            )}
          >
            {message.content}
          </div>
        </div>
      ))}
    </div>
  );
};
