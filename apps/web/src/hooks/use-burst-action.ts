import { useAsyncRateLimitedCallback } from "@tanstack/react-pacer/async-rate-limiter";
import { useCallback } from "react";
import { ExpectedError } from "@/lib/expected-error";

export const BURST_ACTION_REJECT_MESSAGE =
  "You're acting too fast. Please wait a moment.";

export const BURST_ACTION_LOST_MESSAGE =
  "Something went wrong. Please try again.";

type AsyncFn<TArgs extends unknown[], TResult> = (
  ...args: TArgs
) => Promise<TResult>;

type UseBurstActionOptions = {
  limit?: number;
  rejectMessage?: string;
  windowMs?: number;
};

export function useBurstAction<TArgs extends unknown[], TResult>(
  action: AsyncFn<TArgs, TResult>,
  options?: UseBurstActionOptions,
) {
  const limited = useAsyncRateLimitedCallback(action, {
    limit: options?.limit ?? 4,
    window: options?.windowMs ?? 10_000,
    windowType: "sliding",
    onReject: () => {
      throw new ExpectedError(
        options?.rejectMessage ?? BURST_ACTION_REJECT_MESSAGE,
      );
    },
    // The library's default unmount cleanup aborts the call in flight, which
    // makes it resolve undefined and drops the server's answer. Nothing here
    // reads the abort signal, so the call is left to finish.
    onUnmount: () => {},
  });

  return useCallback(
    async (...args: TArgs) => {
      const res = await limited(...args);
      // An action always resolves an object, so undefined means the limiter
      // lost the result. Callers would read that as success.
      if (res === undefined) throw new Error(BURST_ACTION_LOST_MESSAGE);
      return res;
    },
    [limited],
  );
}
