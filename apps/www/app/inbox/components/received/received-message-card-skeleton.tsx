import { Skeleton } from "@umamin/ui/components/skeleton";
import { Icons } from "@/lib/icons";

export function ReceivedMessageCardSkeleton() {
  return (
    <div className="min-w-2 w-full group relative bg-card p-6 rounded-xl border">
      <div className="absolute top-4 right-4 text-muted-foreground">
        <Icons.elipsisVertical className="h-4 w-4" />
      </div>

      <div className="font-bold text-center leading-normal text-lg min-w-0 break-words mb-4">
        <Skeleton className="h-6 w-3/4 mx-auto" />
      </div>

      <div className="flex w-full flex-col gap-2 rounded-lg p-5 whitespace-pre-wrap bg-muted break-words min-w-0">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/5" />
      </div>

      <div className="text-muted-foreground text-sm mt-4 italic text-center">
        <Skeleton className="h-4 w-24 mx-auto" />
      </div>
    </div>
  );
}
