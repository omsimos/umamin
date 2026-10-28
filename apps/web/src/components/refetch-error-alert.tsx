import { Alert, AlertDescription } from "@umamin/ui/components/alert";
import { Button } from "@umamin/ui/components/button";
import { AlertCircleIcon } from "lucide-react";

// Shown above a list that still has cached data when a refetch or next page
// fails; the full-page error is reserved for "never loaded".
export function RefetchErrorAlert({
  onRetry,
  retrying,
}: {
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <Alert variant="destructive" className="mb-3">
      <AlertCircleIcon className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between gap-3">
        Couldn't refresh. Showing what was loaded.
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          disabled={retrying}
        >
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}
