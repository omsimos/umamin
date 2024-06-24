import { Skeleton } from "@umamin/ui/components/skeleton";

export default function Loading() {
  return (
    <div className="mt-28 mx-auto container max-w-xl gap-5 flex flex-col">
      <Skeleton className="w-full h-[80px] rounded-md" />

      <div className="flex justify-between mb-5">
        <div className="flex gap-2 items-center">
          <Skeleton className="w-[60px] h-[30px] rounded-full" />
          <Skeleton className="w-[70px] h-[15px] rounded-md" />
        </div>
        <Skeleton className="w-[130px] h-[40px] rounded-md" />
      </div>

      <div className="flex flex-col gap-2">
        <Skeleton className="w-[70px] h-[10px] rounded-md" />
        <Skeleton className="w-full h-[150px] rounded-md" />
      </div>
      <Skeleton className="w-full h-[150px] rounded-md" />
    </div>
  );
}
