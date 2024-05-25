import { Skeleton } from "@umamin/ui/components/skeleton";

export default function Loading() {
  return (
    <div className="container max-w-xl lg:mt-36 mt-28 mx-auto ">
      <Skeleton className="w-full h-[200px] rounded-2xl" />

      <div className="space-y-5 mt-24">
        <Skeleton className="w-full h-[200px] rounded-lg" />
        <Skeleton className="w-full h-[200px] rounded-lg" />
        <Skeleton className="w-full h-[200px] rounded-lg" />
      </div>
    </div>
  );
}
