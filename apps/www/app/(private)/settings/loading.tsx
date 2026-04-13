import { Skeleton } from "@umamin/ui/components/skeleton";
import { SettingsSkeleton } from "./components/settings-skeleton";

export default function Loading() {
  return (
    <div className="w-full mx-auto max-w-lg container min-h-screen pb-24">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-44" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>

      <div className="mt-12">
        <SettingsSkeleton />
      </div>
    </div>
  );
}
