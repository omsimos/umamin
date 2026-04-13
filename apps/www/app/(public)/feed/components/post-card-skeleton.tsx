import { Skeleton } from "@umamin/ui/components/skeleton";

export function PostCardSkeleton() {
  return (
    <div className="flex space-x-3 container border-b border-muted pb-6 text-[15px]">
      <Skeleton className="h-10 w-10 rounded-full" />

      <div className="w-full space-y-3">
        <div className="flex justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-3 w-12" />
        </div>

        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>

        <div className="flex items-center space-x-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
    </div>
  );
}
