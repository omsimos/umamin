import { Avatar, AvatarFallback } from "@umamin/ui/components/avatar";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { CalendarDaysIcon, Link2Icon } from "lucide-react";

export function UserCardSkeleton() {
  return (
    <div>
      <section className="flex gap-4">
        <Avatar className="md:h-20 md:w-20 h-16 w-16">
          <AvatarFallback>
            <Skeleton className="w-full h-full rounded-full" />
          </AvatarFallback>
        </Avatar>

        <div>
          <div className="flex items-center gap-2">
            <div className="flex items-center space-x-1">
              <Skeleton className="h-6 w-32 md:h-7 md:w-40" />
            </div>
            <Skeleton className="h-4 w-4" />
          </div>
          <Skeleton className="h-4 w-24 mt-1" />
        </div>
      </section>

      <section className="mt-4">
        <div className="mt-4 space-y-1">
          <div className="text-muted-foreground flex items-center">
            <Link2Icon className="h-4 w-4 mr-2" />
            <Skeleton className="w-48 h-5" />
          </div>

          <div className="text-muted-foreground text-sm flex items-center">
            <CalendarDaysIcon className="h-4 w-4 mr-2" />
            <span>Joined </span>
            <Skeleton className="w-20 h-4 ml-1" />
          </div>
        </div>
      </section>
    </div>
  );
}
