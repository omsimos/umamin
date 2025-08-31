import { Card, CardContent, CardHeader } from "@umamin/ui/components/card";
import { Skeleton } from "@umamin/ui/components/skeleton";

export function NoteCardSkeleton() {
  return (
    <Card className="flex flex-col items-start justify-between">
      <CardHeader className="w-full pb-4 text-sm">
        <div className="flex justify-between items-start">
          <div className="flex gap-3">
            {/* Avatar skeleton */}
            <Skeleton className="h-10 w-10 rounded-full" />

            <div className="flex flex-col mt-1 gap-1">
              {/* Display name skeleton */}
              <Skeleton className="h-4 w-24" />
              {/* Username skeleton */}
              <Skeleton className="h-3 w-16" />
            </div>
          </div>

          <div className="flex gap-x-1 items-center">
            {/* Timestamp skeleton */}
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex w-full gap-3">
        <div className="w-full space-y-2">
          {/* Content skeleton - multiple lines with varying widths */}
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </CardContent>
    </Card>
  );
}
