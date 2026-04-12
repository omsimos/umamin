import { Skeleton } from "@umamin/ui/components/skeleton";
import { PostCardSkeleton } from "@/app/feed/components/post-card-skeleton";

export default function Loading() {
  return (
    <main className="w-full sm:max-w-lg mx-auto bg-background">
      <div className="space-y-6">
        <PostCardSkeleton />

        <div className="w-full py-4 border-b px-7 sm:px-0">
          <div className="flex gap-3 w-full">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-10 w-full" />
              <div className="flex justify-end">
                <Skeleton className="h-9 w-12" />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 my-6">
          <PostCardSkeleton />
          <PostCardSkeleton />
          <PostCardSkeleton />
        </div>
      </div>
    </main>
  );
}
