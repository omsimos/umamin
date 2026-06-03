import type { ErrorComponentProps } from "@tanstack/react-router";
import { Button } from "@umamin/ui/components/button";

// "Back to lobby" hard-navigates (not router nav) to guarantee a clean state.
export function RouteError({ error, reset }: ErrorComponentProps) {
  return (
    <div
      role="alert"
      className="flex min-h-dvh flex-col items-center justify-center p-6 text-center"
    >
      <div aria-hidden className="mb-3 text-4xl">
        😵
      </div>
      <h1 className="font-display text-lg font-bold">Something went wrong</h1>
      <p className="text-muted-foreground mt-1 mb-5 max-w-xs text-sm">
        The chat hit an unexpected error. Try again, or head back to the lobby
        to start fresh.
      </p>
      {import.meta.env.DEV && error?.message && (
        <pre className="text-muted-foreground mb-5 max-w-sm overflow-auto rounded-md border p-3 text-left text-xs">
          {error.message}
        </pre>
      )}
      <div className="flex gap-2">
        <Button className="rounded-full" onClick={() => reset()}>
          Try again
        </Button>
        <Button
          variant="ghost"
          className="rounded-full"
          onClick={() => {
            window.location.assign("/");
          }}
        >
          Back to lobby
        </Button>
      </div>
    </div>
  );
}
