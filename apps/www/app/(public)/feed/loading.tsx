import { Skeleton } from "@umamin/ui/components/skeleton";
import { PostCardSkeleton } from "./components/post-card-skeleton";

export default function Loading() {
  return (
    <main className="pb-40">
      <section className="pt-6 w-full max-w-xl mx-auto bg-background border-muted">
        {/* Hot / Latest tabs placeholder (matches LinkTabs) */}
        <nav className="mb-5 flex w-full border-b">
          <div className="flex flex-1 justify-center pb-2.5">
            <Skeleton className="h-5 w-12" />
          </div>
          <div className="flex flex-1 justify-center pb-2.5">
            <Skeleton className="h-5 w-14" />
          </div>
        </nav>

        <div className="space-y-6">
          <PostCardSkeleton />
          <PostCardSkeleton />
          <PostCardSkeleton />
        </div>
      </section>
    </main>
  );
}
