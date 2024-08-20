import { Skeleton } from "@umamin/ui/components/skeleton";

export default function Loading() {
  return (
    <div className="container max-w-xl lg:mt-36 mt-28 mx-auto ">
      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          <Skeleton className="size-16 md:size-20 rounded-full" />

          <div className="flex flex-col gap-2">
            <Skeleton className="h-[20px] w-[80px] rounded-md" />
            <Skeleton className="h-[15px] w-[50px] rounded-md" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex gap-1 items-center">
            <Skeleton className="size-[15px] rounded-full" />
            <Skeleton className="h-[10px] w-[130px] rounded-md" />
          </div>

          <div className="flex gap-1 items-center">
            <Skeleton className="size-[15px] rounded-full" />
            <Skeleton className="h-[10px] w-[130px] rounded-md" />
          </div>
        </div>
      </div>

      <div className="space-y-5 mt-8">
        <div>
          <div className="flex justify-around">
            <Skeleton className="h-[15px] w-[90px] rounded-md" />
            <Skeleton className="h-[15px] w-[90px] rounded-md" />
          </div>

          <Skeleton className="w-full h-[2px] rounded-md mt-2" />
        </div>

        <Skeleton className="w-full h-[200px] rounded-md" />
        <Skeleton className="w-full h-[200px] rounded-md" />
      </div>
    </div>
  );
}
