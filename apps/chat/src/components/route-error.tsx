import type { ErrorComponentProps } from "@tanstack/react-router";
import { Button } from "@umamin/ui/components/button";

/**
 * Router-level fallback for any render/load error in a route (registered as the
 * router's `defaultErrorComponent`). Without it a crash in the chat UI would
 * white-screen with nothing to catch or recover from. "Try again" resets the
 * error boundary in place; "Back to lobby" hard-navigates to a clean state.
 */
export function RouteError({ error, reset }: ErrorComponentProps) {
  return (
    <div
      role="alert"
      className="flex min-h-dvh flex-col items-center justify-center p-6 text-center"
    >
      <div aria-hidden className="mb-3 text-4xl">
        😵
      </div>
      <h1 className="text-lg font-bold">Something went wrong</h1>
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
