import { Avatar, AvatarFallback } from "@ui/components/ui/avatar";
import { cn } from "@umamin/ui/lib/utils";
import { ScanFace } from "lucide-react";

type Message = {
  role: string;
  content: string;
  // Profile info for profile hover card
};

export const ChatList = ({ messages }: { messages: Message[] }) => {
  return (
    <div className="h-full flex pb-10 overflow-y-auto flex-col w-full py-10 px-7 gap-4">
      {messages.map((message, index) => (
        <div className="flex gap-2 items-center">
          {message.role !== "user" && (
            <Avatar>
              <AvatarFallback>
                <ScanFace />
              </AvatarFallback>
            </Avatar>
          )}
          <div
            key={index}
            className={cn(
              "flex w-max max-w-[55%] flex-col gap-2 rounded-lg px-3 py-2 whitespace-pre-wrap",
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
