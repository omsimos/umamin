import { toast } from "sonner";
import {
  BURST_ACTION_REJECT_MESSAGE,
  useBurstAction,
} from "@/hooks/use-burst-action";
import {
  type ToggleState,
  unchangedOutcome,
  useOptimisticToggle,
} from "@/hooks/use-optimistic-toggle";
import { ExpectedError } from "@/lib/expected-error";
import { captureException } from "@/lib/posthog";
import { getActionError } from "@/lib/utils";

type ReactionToggleOptions = {
  on: boolean;
  count: number;
  // Calls the add or remove action for the target state and resolves its
  // result envelope.
  request: (next: boolean) => Promise<unknown>;
  // True when the response says the server was already in the target state,
  // so its counter never moved.
  isNoop: (res: unknown, next: boolean) => boolean;
  // Runs after any response that is not an error. Each surface's toasts live
  // here, because they differ per surface.
  onResponse?: (next: boolean, noop: boolean) => void;
  // Writes the state the server confirmed into the cache.
  writeCache: (state: ToggleState) => void;
  // Toast text for a failure that carries no message.
  fallbackError: string;
  // Error tracking source. Left out, a failure is not reported.
  errorSource?: string;
  // Requests allowed per 10 seconds. Defaults to 4.
  burstLimit?: number;
};

// The request half of a like-style toggle: rate limit, read the action's
// envelope, tell a real change from a server no-op, and toast or report a
// failure. useOptimisticToggle owns the button state.
export function useReactionToggle({
  on,
  count,
  request,
  isNoop,
  onResponse,
  writeCache,
  fallbackError,
  errorSource,
  burstLimit = 4,
}: ReactionToggleOptions) {
  const limited = useBurstAction(request, {
    limit: burstLimit,
    rejectMessage: BURST_ACTION_REJECT_MESSAGE,
  });

  return useOptimisticToggle({
    on,
    count,
    send: async (next) => {
      const res = await limited(next);
      const actionError = getActionError(res);
      if (actionError) {
        throw new ExpectedError(actionError);
      }
      // A no-op leaves the server's count where it was, so the optimistic ±1
      // is dropped for the server's count.
      const noop = isNoop(res, next);
      onResponse?.(next, noop);
      return noop ? unchangedOutcome(res) : "changed";
    },
    onSettled: writeCache,
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : fallbackError);
      if (errorSource) captureException(err, { source: errorSource });
    },
  });
}
