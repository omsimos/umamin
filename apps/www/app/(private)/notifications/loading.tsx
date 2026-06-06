import { Skeleton } from "@umamin/ui/components/skeleton";
import { NotificationListSkeleton } from "./components/notification-skeleton";

export default function Loading() {
  return (
    <main className="max-w-xl mx-auto min-h-screen container">
      <Skeleton className="h-7 w-40" />

      <div className="mt-5">
        <NotificationListSkeleton />
      </div>
    </main>
  );
}
