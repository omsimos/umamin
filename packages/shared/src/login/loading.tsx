import { Skeleton } from "@umamin/ui/components/skeleton";

export default function Loading() {
  return (
    <div className="max-w-lg md:max-w-md container mt-16 [&>div]:gap-3 [&>div]:flex [&>div]:flex-col flex gap-8 flex-col">
      <div>
        <Skeleton className="w-2/5 h-[25px] rounded-md" />
        <Skeleton className="w-1/2 h-[10px] rounded-md" />
      </div>

      <div>
        <Skeleton className="w-1/5 h-[10px] rounded-md" />
        <Skeleton className="w-full h-[30px] rounded-md" />
      </div>

      <div>
        <Skeleton className="w-1/5 h-[10px] rounded-md" />
        <Skeleton className="w-full h-[30px] rounded-md" />
      </div>

      <div>
        <Skeleton className="w-full h-[30px] rounded-md" />
        <Skeleton className="w-full h-[30px] rounded-md" />
        <Skeleton className="mx-auto w-1/2 h-[10px] rounded-md" />
      </div>
    </div>
  );
}
