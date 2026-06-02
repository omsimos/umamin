import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@umamin/ui/components/button";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Umamin Chat</h1>
        <p className="text-muted-foreground">
          Edit{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            src/routes/index.tsx
          </code>{" "}
          to get started.
        </p>
      </div>
      <Button>Get started</Button>
    </main>
  );
}
