"use client";

import { Button } from "@umamin/ui/components/button";

export default function RootError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h2 className="font-display text-2xl font-semibold">
        Something went wrong
      </h2>
      <p className="text-muted-foreground text-sm">
        An unexpected error occurred. Please try again.
      </p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
