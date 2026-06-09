import { Skeleton } from "@umamin/ui/components/skeleton";
import { CalendarDaysIcon, Link2Icon } from "lucide-react";

export function UserCardSkeleton() {
  return (
    <div>
      <div className="relative">
        <Skeleton className="aspect-[3/1] w-full rounded-xl" />
        {/* Mirrors UserCard: avatar straddling the banner's bottom-left. */}
        <Skeleton className="absolute -bottom-8 left-4 size-16 rounded-full ring-4 ring-background md:size-20" />
      </div>

      <section className="mt-11">
        <Skeleton className="h-6 w-32 md:h-7 md:w-40" />
        <Skeleton className="mt-1 h-4 w-24" />

        <div className="mt-4 space-y-1">
          <div className="text-muted-foreground flex items-center">
            <Link2Icon className="mr-2 h-4 w-4" />
            <Skeleton className="h-5 w-48" />
          </div>

          <div className="text-muted-foreground text-sm flex items-center">
            <CalendarDaysIcon className="mr-2 h-4 w-4" />
            <span>Joined </span>
            <Skeleton className="ml-1 h-4 w-20" />
          </div>
        </div>
      </section>
    </div>
  );
}
