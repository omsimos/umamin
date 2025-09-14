import { ScanFaceIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@umamin/ui/components/avatar";
import { Skeleton } from "@umamin/ui/components/skeleton";

export const ChatListSkeleton = () => {
  return (
    <div className="flex flex-col min-w-0">
      {/* Initial message */}
      <div className="flex gap-2 items-end">
        <Avatar>
          <AvatarFallback>
            <ScanFaceIcon />
          </AvatarFallback>
        </Avatar>
        <div className="max-w-[75%] sm:max-w-[55%] rounded-lg px-3 py-2 bg-muted w-full">
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>

      {/* Reply message */}
      <div className="max-w-[75%] sm:max-w-[55%] rounded-lg px-3 py-2 bg-primary mt-6 self-end w-full">
        <Skeleton className="h-4 w-full mb-2 bg-primary-foreground/20" />
        <Skeleton className="h-4 w-2/3 bg-primary-foreground/20" />
      </div>

      {/* Response message */}
      <div className="flex gap-2 items-end mt-6">
        <Avatar>
          <AvatarFallback>
            <ScanFaceIcon />
          </AvatarFallback>
        </Avatar>
        <div className="max-w-[75%] sm:max-w-[55%] rounded-lg px-3 py-2 bg-muted w-full">
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>
    </div>
  );
};
