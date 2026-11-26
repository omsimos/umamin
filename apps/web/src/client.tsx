import { StartClient } from "@tanstack/react-start/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { reportRecoverableError } from "@/lib/recoverable-error";

// TanStack Start's default client entry, plus onRecoverableError so hydration
// mismatches reach error tracking with their component stack.
startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
    { onRecoverableError: reportRecoverableError },
  );
});
