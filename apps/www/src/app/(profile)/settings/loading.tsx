import { Skeleton } from "@umamin/ui/components/skeleton";

export default function Loading() {
  return (
    <div className="full mx-auto max-w-lg container lg:mt-36 mt-28 [&>div]:gap-3 [&>div]:flex flex gap-8 flex-col">
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-3">
          <Skeleton className="w-24 h-[25px] rounded-md" />
          <Skeleton className="w-44 h-[10px] rounded-md" />
        </div>

        <Skeleton className="w-20 h-[30px] rounded-md" />
      </div>

      <div className="flex flex-col mt-10">
        <div className="flex justify-around">
          <Skeleton className="h-[15px] w-[90px] rounded-md" />
          <Skeleton className="h-[15px] w-[90px] rounded-md" />
          <Skeleton className="h-[15px] w-[90px] rounded-md" />
        </div>

        <Skeleton className="w-full h-[2px] rounded-md " />
      </div>

      <div className="flex-col">
        <Skeleton className="w-1/5 h-[10px] rounded-md" />
        <Skeleton className="w-full h-[30px] rounded-md" />
      </div>

      <div className="flex-col">
        <Skeleton className="w-1/5 h-[10px] rounded-md" />
        <Skeleton className="w-full h-[30px] rounded-md" />
        <Skeleton className="w-1/2 h-[10px] rounded-md" />
      </div>

      <div className="flex-col">
        <Skeleton className="w-1/5 h-[10px] rounded-md" />
        <Skeleton className="w-full h-[90px] rounded-md" />
      </div>

      <Skeleton className="w-full h-[30px] rounded-md" />
    </div>
  );
}
