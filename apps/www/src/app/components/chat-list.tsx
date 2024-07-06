import { ScanFace } from "lucide-react";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@umamin/ui/components/avatar";
import { cn } from "@umamin/ui/lib/utils";

type Props = {
  imageUrl?: string | null;
  question: string;
  reply?: string;
  response?: string;
  anonymous?: boolean;
};

export const ChatList = ({
  imageUrl,
  question,
  reply,
  response,
  anonymous,
}: Props) => {
  return (
    <div className="flex flex-col">
      <div className="flex gap-2 items-end">
        <Avatar>
          {!anonymous ? (
            <>
              <AvatarImage className="rounded-full" src={imageUrl ?? ""} />
              <AvatarFallback>
                <ScanFace />
              </AvatarFallback>
            </>
          ) : (
            <AvatarFallback>
              <ScanFace />
            </AvatarFallback>
          )}
        </Avatar>
        <div className="max-w-[75%] sm:max-w-[55%] rounded-lg px-3 py-2 whitespace-pre-wrap bg-muted min-w-0 break-words">
          {question}
        </div>
      </div>

      {reply && (
        <div
          className={cn(
            "max-w-[75%] sm:max-w-[55%] rounded-lg px-3 py-2 whitespace-pre-wrap bg-primary text-primary-foreground mt-6 self-end min-w-0 break-words"
          )}
        >
          {reply}
        </div>
      )}

      {response && (
        <div className="flex gap-2 items-center">
          <Avatar>
            <AvatarImage className="rounded-full" src={imageUrl ?? ""} />
            <AvatarFallback>
              <ScanFace />
            </AvatarFallback>
          </Avatar>
          <div className="max-w-[75%] sm:max-w-[55%] rounded-lg px-3 py-2 whitespace-pre-wrap bg-muted min-w-0 break-words">
            {response}
          </div>
        </div>
      )}
    </div>
  );
};
