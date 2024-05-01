import { ScanFace } from "lucide-react";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@umamin/ui/components/avatar";
import { cn } from "@umamin/ui/lib/utils";

type Props = {
  imageUrl?: string;
  question: string;
  reply: string;
};

export const ChatList = ({ imageUrl, question, reply }: Props) => {
  return (
    <div className="flex flex-col">
      <div className="flex gap-2 items-center">
        <Avatar>
          <AvatarImage className="rounded-full" src={imageUrl} />
          <AvatarFallback>
            <ScanFace />
          </AvatarFallback>
        </Avatar>
        <div className="max-w-[75%] sm:max-w-[55%] rounded-lg px-3 py-2 whitespace-pre-wrap bg-muted">
          {question}
        </div>
      </div>

      {reply && (
        <div
          className={cn(
            "max-w-[75%] sm:max-w-[55%] rounded-lg px-3 py-2 whitespace-pre-wrap bg-primary text-primary-foreground mt-6 mb-12 self-end",
          )}
        >
          {reply}
        </div>
      )}
    </div>
  );
};
