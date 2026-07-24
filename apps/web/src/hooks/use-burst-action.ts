"use client";

import { useAsyncRateLimitedCallback } from "@tanstack/react-pacer/async-rate-limiter";

export const BURST_ACTION_REJECT_MESSAGE =
  "You're acting too fast. Please wait a moment.";

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
  return useAsyncRateLimitedCallback(action, {
    limit: options?.limit ?? 4,
    window: options?.windowMs ?? 10_000,
    windowType: "sliding",
    onReject: () => {
      throw new Error(options?.rejectMessage ?? BURST_ACTION_REJECT_MESSAGE);
    },
  });
}
