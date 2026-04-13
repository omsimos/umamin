import { Skeleton } from "@umamin/ui/components/skeleton";
import { UserCardSkeleton } from "@/components/skeleton/user-card-skeleton";
import { ReceivedMessageCardSkeleton } from "./components/received/received-message-card-skeleton";

export default function Loading() {
  return (
    <main className="max-w-xl mx-auto min-h-screen container">
      <UserCardSkeleton />

      <div className="mt-4 space-y-4">
        <div className="flex gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>

        <ReceivedMessageCardSkeleton />
        <ReceivedMessageCardSkeleton />
      </div>
    </main>
  );
}
