import { Skeleton } from "@umamin/ui/components/skeleton";

function NotificationRowSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="size-9 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

export function NotificationListSkeleton() {
  return (
    <div className="space-y-4">
      <NotificationRowSkeleton />
      <NotificationRowSkeleton />
      <NotificationRowSkeleton />
      <NotificationRowSkeleton />
      <NotificationRowSkeleton />
    </div>
  );
}
