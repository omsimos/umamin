import { ScanFace } from "lucide-react";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@umamin/ui/components/avatar";
import { cn } from "@umamin/ui/lib/utils";

export const ChatList = ({ imageUrl }: { imageUrl: string }) => {
  return (
    <div className="h-full flex pb-10 overflow-y-auto flex-col w-full py-10 px-5 sm:px-7 gap-4">
      <div className="flex gap-2 items-center">
        <Avatar>
          <AvatarImage className="rounded-full" src={imageUrl} />
          <AvatarFallback>
            <ScanFace />
          </AvatarFallback>
        </Avatar>
        <div
          className={cn(
            "flex w-max max-w-[75%] sm:max-w-[55%] flex-col gap-2 rounded-lg px-3 py-2 whitespace-pre-wrap bg-muted",
          )}
        >
          The quick brown fox jumps over the lazy dog near the bank of the
          river?
        </div>
      </div>

      <div
        className={cn(
          "flex w-max max-w-[75%] sm:max-w-[55%] flex-col gap-2 rounded-lg px-3 py-2 whitespace-pre-wrap ml-auto bg-primary text-primary-foreground",
        )}
      >
        Near the bank of the river, the fox really did it!!
      </div>
    </div>
  );
};
