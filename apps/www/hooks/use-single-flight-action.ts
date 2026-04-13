"use client";

import { useCallback, useRef } from "react";

type AsyncFn<TArgs extends unknown[], TResult> = (
  ...args: TArgs
) => Promise<TResult>;

export function useSingleFlightAction<TArgs extends unknown[], TResult>(
  action: AsyncFn<TArgs, TResult>,
) {
  const inFlightRef = useRef<Promise<TResult> | null>(null);

  return useCallback(
    (...args: TArgs) => {
      if (inFlightRef.current) {
        return inFlightRef.current;
      }

      const promise = action(...args).finally(() => {
        inFlightRef.current = null;
      });

      inFlightRef.current = promise;
      return promise;
    },
    [action],
  );
}
