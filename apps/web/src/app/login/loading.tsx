import { Skeleton } from "@umamin/ui/components/skeleton";

export default function Loading() {
  return (
    <div className="container">
      <Skeleton className="w-full max-w-lg h-[400px] rounded-lg mx-auto mt-36" />
    </div>
  );
}

