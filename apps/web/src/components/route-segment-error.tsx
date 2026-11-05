import { useRouter } from "@tanstack/react-router";
import { Button } from "@umamin/ui/components/button";
import { cn } from "@umamin/ui/lib/utils";
import { useEffect, useState } from "react";
import { AnimatedShinyText } from "@/components/animated-shiny-text";
import { Link } from "@/lib/navigation";
import { captureException } from "@/lib/posthog";
import { RequestFailedError } from "@/lib/request-error";

type Props = {
  // TanStack Router hands the boundary an `unknown` — a thrown non-Error is
  // reportable all the same, so widen rather than assert.
  error: unknown;
  // Passed by the router, deliberately unused: see the Try Again handler.
  reset?: () => void;
  heading?: string;
};

// The read wrappers report their own 5xx, so the client copy would only double
// the issue. A loader error from SSR arrives here as a plain Error with the
// message intact, so the status is read from the message too.
export function isServerReportedError(error: unknown): boolean {
  if (error instanceof RequestFailedError) return error.status >= 500;
  return error instanceof Error && /\(5\d\d\)$/.test(error.message);
}

export function RouteSegmentError({
  error,
  heading = "Something went wrong!",
}: Props) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    console.error(error);
    if (isServerReportedError(error)) return;
    // React error boundaries swallow render errors before window.onerror sees
    // them, so exception autocapture cannot pick this up on its own.
    captureException(error, {
      boundary: "route-segment",
      route: window.location.pathname,
    });
  }, [error]);

  // The boundary's own reset() re-renders a match that is still in the error
  // state, so the router throws the same error again. Invalidating re-runs the
  // loaders, and the boundary clears itself once the match changes.
  const retry = async () => {
    setRetrying(true);
    try {
      await router.invalidate();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="flex items-center flex-col min-h-screen lg:pt-44 py-36 md:gap-8 gap-6 container">
      <div
        className={cn(
          "group rounded-full border border-black/5 bg-zinc-100 text-base text-white transition-all ease-in dark:border-white/5 dark:bg-zinc-900",
        )}
      >
        <AnimatedShinyText className="inline-flex items-center justify-center px-4 py-1 transition ease-out">
          Error
        </AnimatedShinyText>
      </div>
      <div className="border-b-2 border-muted border-dashed md:pb-8 pb-6">
        <h1 className="font-extrabold md:text-7xl text-[10vw] leading-none dark:bg-linear-to-b from-foreground dark:to-zinc-400 bg-clip-text bg-zinc-800 text-transparent tracking-tighter text-center">
          {heading}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <Button size="lg" className="md:text-base" asChild>
          <Link href="/">Go Back</Link>
        </Button>

        <Button
          variant="outline"
          size="lg"
          className="w-full lg:text-base"
          disabled={retrying}
          onClick={retry}
        >
          Try Again
        </Button>
      </div>
    </div>
  );
}
