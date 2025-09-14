import { Skeleton } from "@umamin/ui/components/skeleton";

export function SettingsSkeleton() {
  return (
    <div className="space-y-6 w-full">
      {/* Display Name Field */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" /> {/* Label */}
        <Skeleton className="h-10 w-full" /> {/* Input field */}
      </div>

      {/* Username Field */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" /> {/* Label */}
        <Skeleton className="h-10 w-full" /> {/* Input field */}
        <Skeleton className="h-4 w-80" /> {/* Helper text */}
      </div>

      {/* Custom Message Field */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" /> {/* Label */}
        <Skeleton className="h-[100px] w-full" /> {/* Textarea */}
      </div>

      {/* Bio Field */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-8" /> {/* Label */}
        <Skeleton className="h-[100px] w-full" /> {/* Textarea */}
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <Skeleton className="h-10 w-32" /> {/* Save Changes button */}
      </div>
    </div>
  );
}
