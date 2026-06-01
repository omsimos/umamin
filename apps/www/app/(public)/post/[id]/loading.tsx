import { Skeleton } from "@umamin/ui/components/skeleton";
import { PostCardSkeleton } from "@/app/(public)/feed/components/post-card-skeleton";

export default function Loading() {
  return (
    <main className="-mt-24 min-h-svh w-full sm:max-w-lg mx-auto bg-background">
      <div className="flex items-center justify-between border-b px-2 py-2">
        <Skeleton className="size-9 rounded-md" />
        <Skeleton className="h-5 w-12" />
        <Skeleton className="size-9 rounded-md" />
      </div>

      <PostCardSkeleton />

      <div className="space-y-6 my-6">
        <PostCardSkeleton />
        <PostCardSkeleton />
        <PostCardSkeleton />
      </div>
    </main>
  );
}
