import { Skeleton } from "@umamin/ui/components/skeleton";

export function SettingsSkeleton() {
  return (
    <div className="space-y-6 w-full">
      {/* Display Name Field */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>

      {/* Username Field */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Custom Message Field */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-[100px] w-full" />
      </div>

      {/* Bio Field */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-8" />
        <Skeleton className="h-[100px] w-full" />
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}
