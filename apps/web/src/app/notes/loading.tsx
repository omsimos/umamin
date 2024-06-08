import { Skeleton } from "@umamin/ui/components/skeleton";

export default function Loading() {
  return (
    <div className="mt-28 mx-auto container max-w-xl gap-5 flex flex-col">
      <Skeleton className="w-full h-[200px] rounded-lg" />
      <Skeleton className="w-full h-[200px] rounded-lg" />
      <Skeleton className="w-full h-[200px] rounded-lg" />
    </div>
  );
}
