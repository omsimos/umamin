import { Skeleton } from "@umamin/ui/components/skeleton";
import { PostCardSkeleton } from "./components/post-card-skeleton";

export default function Loading() {
  return (
    <main className="pb-40">
      <section className="pt-6 w-full max-w-xl mx-auto bg-background border-muted">
        <div className="px-4 pb-6">
          <div className="flex gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-10 w-full" />
              <div className="flex justify-end">
                <Skeleton className="h-9 w-24" />
              </div>
            </div>
          </div>
        </div>

        <div className="border-y space-y-6 pt-6">
          <PostCardSkeleton />
          <PostCardSkeleton />
          <PostCardSkeleton />
        </div>
      </section>
    </main>
  );
}
