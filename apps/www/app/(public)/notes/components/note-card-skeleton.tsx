import { Card, CardContent, CardHeader } from "@umamin/ui/components/card";
import { Skeleton } from "@umamin/ui/components/skeleton";

export function NoteCardSkeleton() {
  return (
    <Card className="flex flex-col items-start justify-between">
      <CardHeader className="w-full pb-4 text-sm">
        <div className="flex justify-between items-start">
          <div className="flex gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />

            <div className="flex flex-col mt-1 gap-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>

          <div className="flex gap-x-1 items-center">
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex w-full gap-3">
        <div className="w-full space-y-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-5 w-3/4" />
        </div>
      </CardContent>
    </Card>
  );
}
